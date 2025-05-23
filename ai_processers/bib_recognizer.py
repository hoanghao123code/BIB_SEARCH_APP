import cv2
import string
import torch
from torchvision import transforms
from torchvision.transforms import InterpolationMode
from PIL import Image
from services import CRNN


device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
imgH, imgW, nh = 32, 100, 256
alphabet = string.ascii_uppercase + string.digits

crnn_weights = "weights/best_crnn_3100.pth"
crnn = CRNN.CRNN(imgH, 1, len(alphabet) + 1, nh).to(device)
crnn.load_state_dict(torch.load(crnn_weights, map_location=device))
crnn.eval()

transforms = transforms.Compose([
    transforms.Resize((imgH, imgW), interpolation=InterpolationMode.BILINEAR),
    transforms.ToTensor(),
    transforms.Normalize((0.5,), (0.5,))
])

def decode(pred, alphabet):
    seq = pred.argmax(1).cpu().numpy().tolist()
    res, prev = [], None
    for i in seq:
        if i != prev and i != 0:
            res.append(alphabet[i-1])
        prev = i
    return ''.join(res)

def recognize_bib_crnn(bib_img):
    if bib_img is None:
        return ""
    pil = Image.fromarray(cv2.cvtColor(bib_img, cv2.COLOR_BGR2GRAY))
    tensor = transforms(pil).unsqueeze(0).to(device)

    with torch.no_grad():
        pred = crnn(tensor)[0]
    text = decode(pred, alphabet)
    return text