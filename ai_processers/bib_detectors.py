from ultralytics import YOLO
import cv2

yolo_weights = "weights/best_100_1600.pt"
yolo = YOLO(yolo_weights)

def detetct_bibs_yolov8(img_path):
    ori_img = cv2.imread(img_path)
    if ori_img is None:
        return [], []
    h, w = ori_img.shape[:2]

    results = yolo(img_path)[0]
    box_res = []
    crop_res = []
    for box in results.boxes:
        x1, y1, x2, y2 = box.xyxy.cpu().numpy().astype(int).flatten()
        x1, y1 = max(x1, 0), max(y1, 0)
        x2, y2 = min(x2, w), min(y2, h)
        if x2 <= x1 or y2 <= y1:
            continue

        cropped_bib = ori_img[y1:y2, x1:x2]
        box_res.append((x1, y1, x2, y2))
        crop_res.append(cropped_bib)
    if len(box_res) == 0:
        return [], []
    return box_res, crop_res