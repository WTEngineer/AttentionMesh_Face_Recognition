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
