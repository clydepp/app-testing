import cv2
import mediapipe as mp
import math

class GestureZoomPan:
    def __init__(self):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(max_num_hands=1,
                                         min_detection_confidence=0.7,
                                         min_tracking_confidence=0.7)
        self.mp_draw = mp.solutions.drawing_utils

        self.zoom = 1.0
        self.pan_x = 0.0
        self.pan_y = 0.0

        self.min_zoom = 0.5
        self.max_zoom = 1.5

    def calculate_norm(self, wrist, index_tip):
        norm =  math.sqrt((index_tip.x - wrist.x)**2 + (index_tip.y - wrist.y)**2)
        print(f"The norm value is: {norm}")
        return norm

    def calculate_distance(self, point1, point2, norm):
        return math.sqrt(((point1.x - point2.x)**2/norm) + ((point1.y - point2.y)**2/norm))

    def normalize_zoom(self, distance):
        # Tune sensitivity here
        zoom = distance * 6  # empirical scaling factor
        return max(self.min_zoom, min(self.max_zoom, zoom))

    def detect_pan(self, wrist, index_tip):
        dx = index_tip.x - wrist.x
        dy = index_tip.y - wrist.y
        return dx * 2, dy * 2  # scaled pan values

    def run(self):
        cap = cv2.VideoCapture(0)
        mode = 'zoom'

        print("Spread fingers to zoom (0.5–1.5), point to pan (-1 to 1)")
        print("Press 'z' for ZOOM mode, 'p' for PAN mode, ESC to exit")

        while True:
            ret, frame = cap.read()
            if not ret:
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

                if mode == 'zoom':
                    dist_norm = self.calculate_norm(wrist, index_tip)
                    print(dist_norm)
                    dist = self.calculate_distance(index_tip, thumb_tip, dist_norm)
                    self.zoom = self.normalize_zoom(dist)

                elif mode == 'pan':
                    self.pan_x, self.pan_y = self.detect_pan(wrist, index_tip)

                self.mp_draw.draw_landmarks(frame, hand, self.mp_hands.HAND_CONNECTIONS)

                # Visualize fingertips
                h, w = frame.shape[:2]
                for point in [wrist, index_tip, thumb_tip]:
                    cx, cy = int(point.x * w), int(point.y * h)
                    cv2.circle(frame, (cx, cy), 6, (0, 255, 0), -1)

            # Overlay text
            cv2.putText(frame, f'Mode: {mode.upper()}', (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 150, 0), 2)
            cv2.putText(frame, f'Zoom: {self.zoom:.2f}', (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 0), 2)
            cv2.putText(frame, f'Pan X: {self.pan_x:.2f}', (10, 110), cv2.FONT_HERSHEY_SIMPLEX, 1, (200, 255, 200), 2)
            cv2.putText(frame, f'Pan Y: {self.pan_y:.2f}', (10, 150), cv2.FONT_HERSHEY_SIMPLEX, 1, (200, 200, 255), 2)

            # Zoom slider bar
            zoom_bar_len = int((self.zoom - self.min_zoom) / (self.max_zoom - self.min_zoom) * 200)
            cv2.rectangle(frame, (500, 50), (510, 250), (255, 255, 255), 2)
            cv2.rectangle(frame, (502, 250 - zoom_bar_len), (508, 250), (0, 255, 0), -1)

            cv2.imshow("Hand Zoom & Pan (Mode Switching)", frame)

            key = cv2.waitKey(1)
            if key == 27:
                break
            elif key == ord('z'):
                mode = 'zoom'
                print("Switched to ZOOM mode")
            elif key == ord('p'):
                mode = 'pan'
                print("Switched to PAN mode")

        cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    GestureZoomPan().run()