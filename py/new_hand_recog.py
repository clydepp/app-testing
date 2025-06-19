import cv2
import mediapipe as mp
import math
import time
import asyncio
import websockets
import json
import threading
import logging

# Set up logging to see what's happening
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GestureWebSocketServer:
    def __init__(self):
        self.connected_clients = set()
        self.server = None
        self.server_ready = threading.Event()
        
    async def handle_client(self, websocket):
        self.connected_clients.add(websocket)
        client_addr = websocket.remote_address
        
        try:
            welcome_msg = json.dumps({
                "type": "connection_status",
                "status": "connected",
                "message": "Gesture server ready"
            })
            await websocket.send(welcome_msg)
            
            async for message in websocket:
                try:
                    data = json.loads(message)
                    logger.info(f"Received from UI: {data}")
                    
                    # Handle ping messages
                    if data.get('type') == 'ping':
                        pong_msg = json.dumps({"type": "pong"})
                        await websocket.send(pong_msg)
                        
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON from client: {message}")
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"disconnected from program")
        except Exception as e:
            logger.error(f"connection error: {e}")
        finally:
            self.connected_clients.discard(websocket)
            logger.info(f"clients: {len(self.connected_clients)}")
    
    async def broadcast_zoom(self, zoom_value):
        if not self.connected_clients:
            logger.debug("No clients connected, skipping broadcast")
            return
            
        message = json.dumps({
            "type": "gesture_zoom",
            "zoom": zoom_value,
            "timestamp": time.time()
        })
        
        # Send to all connected clients
        disconnected = set()
        successful_sends = 0
        
        for client in self.connected_clients:
            try:
                await client.send(message)
                successful_sends += 1
            except websockets.exceptions.ConnectionClosed:
                disconnected.add(client)
                logger.info("disconnected during broadcast")
            except Exception as e:
                logger.error(f"error during connection: {e}")
                disconnected.add(client)
        
        # Clean up disconnected clients
        self.connected_clients -= disconnected
        
        logger.info(f"Sent zoom {zoom_value}")
    
    def broadcast_zoom_threaded(self, zoom_value):
        def run_broadcast():
            try:
                # Create new event loop for this thread
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(self.broadcast_zoom(zoom_value))
                loop.close()
            except Exception as e:
                logger.error(f"Broadcast error: {e}")
        
        thread = threading.Thread(target=run_broadcast, daemon=True)
        thread.start()
    
    async def start_server(self):
        logger.info("Starting gesture WebSocket server on localhost:8003")
        try:
            # Start the server
            self.server = await websockets.serve(
                self.handle_client, 
                "localhost", 
                8003,
                ping_interval=20,  # Send ping every 20 seconds
                ping_timeout=10    # Wait 10 seconds for pong
            )
            
            # Signal that server is ready
            self.server_ready.set()
            logger.info("Gesture server running on ws://localhost:8003")
            
            # Keep server running
            await self.server.wait_closed()
            
        except OSError as e:
            if "Address already in use" in str(e):
                logger.error("Port in use - wthelly")
            else:
                logger.error(f"Server startup error: {e}")
            self.server_ready.set()  # reset state (null completion)
        except Exception as e:
            logger.error(f"Unexpected server error: {e}")
            self.server_ready.set() 
    
    def start_server_threaded(self):
        def run_server():
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(self.start_server())
            except Exception as e:
                logger.error(f"Server thread error: {e}")
                self.server_ready.set()  
        
        thread = threading.Thread(target=run_server, daemon=True)
        thread.start()
        
        logger.info("Waiting for server to start...")
        if self.server_ready.wait(timeout=5):
            logger.info("Server startup completed")
            time.sleep(1)  # Give it a moment to settle
        else:
            logger.error("Server startup timed out")

class GestureZoom:
    def __init__(self):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(max_num_hands=1,
                                         min_detection_confidence=0.7,
                                         min_tracking_confidence=0.7)
        self.mp_draw = mp.solutions.drawing_utils

        self.zoom = 1.0
        self.min_zoom = 0.5
        self.max_zoom = 1.5
        # Zoom counter
        self.zoom_counter = 1
        self.last_update_time = time.time()

        self.gesture_server = GestureWebSocketServer()
        self.gesture_server.start_server_threaded()
        
        logger.info("Connection ready")

    def calculate_norm(self, wrist, index_tip):
        norm = math.sqrt((index_tip.x - wrist.x) ** 2 + (index_tip.y - wrist.y) ** 2)
        return norm

    def calculate_distance(self, point1, point2, norm):
        return math.sqrt(((point1.x - point2.x) ** 2 / norm) + ((point1.y - point2.y) ** 2 / norm))

    def normalize_zoom(self, distance):
        if distance > 0.25:
            return 1.5
        elif distance < 0.1:
            return 0.5
        else:
            return 1.0

    def update_zoom_counter(self):
        current_time = time.time()
        if current_time - self.last_update_time >= 1:  # 2s
            old_counter = self.zoom_counter
            if self.zoom == 1.5:
                self.zoom_counter = min(15, self.zoom_counter + 1)
            elif self.zoom == 0.5:
                self.zoom_counter = max(0, self.zoom_counter - 1)
            
            if self.zoom_counter != old_counter:
                self.gesture_server.broadcast_zoom_threaded(self.zoom_counter)
                
            self.last_update_time = current_time

    def run(self):
        cap = None
        for camera_idx in [0, 1, 2]:  # Try multiple camera indices
            cap = cv2.VideoCapture(camera_idx)
            if cap.isOpened():
                logger.info(f"opened camera")
                break
            else:
                cap.release()
        
        if not cap or not cap.isOpened():
            logger.error("could not open camera")
            return
        
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    logger.error("frames cannot be read?")
                    break

                frame = cv2.flip(frame, 1)
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = self.hands.process(rgb)

                if results.multi_hand_landmarks:
                    hand = results.multi_hand_landmarks[0]
                    landmarks = hand.landmark

                    wrist = landmarks[0]
                    index_tip = landmarks[8]
                    thumb_tip = landmarks[4]

                    dist_norm = self.calculate_norm(wrist, index_tip)
                    dist = self.calculate_distance(index_tip, thumb_tip, dist_norm)
                    self.zoom = self.normalize_zoom(dist)
                    self.update_zoom_counter()

                    self.mp_draw.draw_landmarks(frame, hand, self.mp_hands.HAND_CONNECTIONS)

                    h, w = frame.shape[:2]
                    for point in [wrist, index_tip, thumb_tip]:
                        cx, cy = int(point.x * w), int(point.y * h)
                        cv2.circle(frame, (cx, cy), 6, (0, 255, 0), -1)

                # Display info
                cv2.putText(frame, f'Zoom Value: {self.zoom:.1f}', (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 0), 2)
                cv2.putText(frame, f'Zoom Counter: {self.zoom_counter}', (10, 70),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)

                # Zoom bar
                zoom_bar_len = int((self.zoom - self.min_zoom) / (self.max_zoom - self.min_zoom) * 200)
                cv2.rectangle(frame, (500, 50), (510, 250), (255, 255, 255), 2)
                cv2.rectangle(frame, (502, 250 - zoom_bar_len), (508, 250), (0, 255, 0), -1)

                cv2.imshow("Gesture Zoom with Counter", frame)

                key = cv2.waitKey(1) & 0xFF
                if key == 27:  # ESC to exit
                    break
                    
        except KeyboardInterrupt:
            print("placeholder interrupt")
        finally:
            cap.release()
            cv2.destroyAllWindows()

if __name__ == "__main__":
    try:
        gesture_app = GestureZoom()
        gesture_app.run()
    except Exception as e:
        import traceback
        traceback.print_exc()