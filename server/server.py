import cv2
import time
import queue
import numpy as np
from flask_cors import CORS
from threading import Thread
import matplotlib.pyplot as plt
from flask import Flask, request
from flask_socketio import SocketIO
from engineio.async_drivers import threading
from mediapipe.python.solutions.face_mesh import FaceMesh

app = Flask(__name__)

CORS(app)

# Initialize SocketIO with CORS configuration
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# Initialize MediaPipe FaceMesh
face_mesh = FaceMesh()

# Keep track of clients connected
clients = []

# Set a max queue size to limit memory usage
frame_queue = queue.Queue(maxsize=5)  # Limit to 5 frames to prevent overflow

@socketio.on('connect')
def handle_connect():
    print("Client connected")
    clients.append(request.sid)  # Add the client session ID to track connections

    # Start sending data in a background thread
    if len(clients) == 1:  # Start only when the first client connects
        thread = Thread(target=send_data, args=(request.sid,))  # Pass the session ID to the thread
        thread.daemon = True
        thread.start()

@socketio.on('disconnect')
def handle_disconnect():
    print("Client disconnected")
    clients.remove(request.sid)  # Remove the client session ID when they disconnect

# Parameters for mapping to a 3D cube
CUBE_SIZE = 100000

def map_to_cube(landmarks, img_width, img_height):
    """
    Normalize landmarks and scale them to fit within a 3D cube.
    """
    normalized_landmarks = []
    for landmark in landmarks:
        x = landmark.x * img_width
        y = landmark.y * img_height
        z = landmark.z * img_width  # Scale z proportionally
        normalized_landmarks.append((x, y, z))
    
    # Center the cube around the face
    center_x, center_y, center_z = np.mean(normalized_landmarks, axis=0)
    cube_landmarks = [(point[0] - center_x, point[1] - center_y, point[2] - center_z) for point in normalized_landmarks]
    cube_landmarks = [(point[0] * CUBE_SIZE / img_width,
                       point[1] * CUBE_SIZE / img_height,
                       point[2] * CUBE_SIZE / img_width) for point in cube_landmarks]
    return cube_landmarks

def visualize_in_3d(landmarks):
    """
    Visualize landmarks in a 3D plot using matplotlib.
    """
    fig = plt.figure()
    ax = fig.add_subplot(111, projection='3d')

    x_coords = [point[0] for point in landmarks]
    y_coords = [point[1] for point in landmarks]
    z_coords = [point[2] for point in landmarks]

    ax.scatter(x_coords, y_coords, z_coords, c='r', marker='o')
    ax.set_xlabel('X')
    ax.set_ylabel('Y')
    ax.set_zlabel('Z')
	plt.show()
def send_data(client_sid):
    # video_source = "../assets/2.mp4"  # For webcam input, use video source 0
    video_source = 0
    cap = cv2.VideoCapture(video_source)
    if not cap.isOpened():
        print("Error: Unable to open video source.")
        return

    prev_time = time.time()  # Track time for frame rate

    while True:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                print("End of video. Restarting...")
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # Restart the video
                break

            # Flip frame horizontally for a mirrored view (optional)
            frame = cv2.flip(frame, 1)

            # Convert frame to RGB for MediaPipe processing
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_mesh.process(rgb_frame)

            # Get image dimensions
            img_height, img_width, _ = frame.shape

            mediapipe_points = []
            if results.multi_face_landmarks:
                # Extract landmarks and convert them to mediapipe_points format
                for face_landmarks in results.multi_face_landmarks:
                    # landmarks = face_landmarks.landmark
                    # mapped_landmarks = map_to_cube(landmarks, img_width, img_height)
                    # visualize_in_3d(mapped_landmarks)
                    for landmark in face_landmarks.landmark:
                        # Convert normalized landmark coordinates (x, y, z) to a list
                        point = {"x": landmark.x, "y": landmark.y, "z": landmark.z}
                        mediapipe_points.append(point)

                        # Draw landmarks on the frame
                        x = int(landmark.x * img_width)
                        y = int(landmark.y * img_height)
                        cv2.circle(frame, (x, y), 2, (0, 255, 0), -1)

            # Ensure the queue does not overflow
            if frame_queue.full():
                frame_queue.get()  # Remove the oldest frame
def display_frames():
    while True:
        if not frame_queue.empty():
            frame = frame_queue.get()
            cv2.imshow('FaceMesh Detection', frame)

            # Exit on pressing 'q'
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

    cv2.destroyAllWindows()
if __name__ == '__main__':
    # Start the frame display in a separate thread
    display_thread = Thread(target=display_frames)
    display_thread.daemon = True
    display_thread.start()

    socketio.run(app)
