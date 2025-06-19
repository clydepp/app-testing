import cv2
import mediapipe as mp
import math
import time

class GestureZoom:
    def __init__(self):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(max_num_hands=1,
                                         min_detection_confidence=0.7,
                                         min_tracking_confidence=0.7)
        self.mp_draw = mp.solutions.drawing_utils

        self.zoom = 1.0
        self.min_zoom = 0.5
        self.max_zoom = 1.5        # Zoom counter
        self.zoom_counter = 1
        self.last_update_time = time.time()

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
        if current_time - self.last_update_time >= 2:  # 2s
            if self.zoom == 1.5:
                self.zoom_counter = min(19, self.zoom_counter + 1)
                print(self.zoom_counter)
            elif self.zoom == 0.5:
                self.zoom_counter = max(1, self.zoom_counter - 1)
                print(self.zoom_counter)
            self.last_update_time = current_time

    def run(self):
        cap = cv2.VideoCapture(0)
        print("Show hand to adjust zoom. Zoom counter will update every 2 seconds based on hand position.")

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

                dist_norm = self.calculate_norm(wrist, index_tip)
                dist = self.calculate_distance(index_tip, thumb_tip, dist_norm)
                self.zoom = self.normalize_zoom(dist)
                self.update_zoom_counter()

                self.mp_draw.draw_landmarks(frame, hand, self.mp_hands.HAND_CONNECTIONS)

                h, w = frame.shape[:2]
                for point in [wrist, index_tip, thumb_tip]:
                    cx, cy = int(point.x * w), int(point.y * h)
                    cv2.circle(frame, (cx, cy), 6, (0, 255, 0), -1)

            # Counter + Val
            cv2.putText(frame, f'Zoom Value: {self.zoom:.1f}', (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 0), 2)
            cv2.putText(frame, f'Zoom Counter: {self.zoom_counter}', (10, 70),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)

            # Zoom bar
            zoom_bar_len = int((self.zoom - self.min_zoom) / (self.max_zoom - self.min_zoom) * 200)
            cv2.rectangle(frame, (500, 50), (510, 250), (255, 255, 255), 2)
            cv2.rectangle(frame, (502, 250 - zoom_bar_len), (508, 250), (0, 255, 0), -1)

            cv2.imshow("Gesture Zoom with Counter", frame)

            key = cv2.waitKey(1)
            if key == 27:  # ESC to exit
                break

        cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    GestureZoom().run()