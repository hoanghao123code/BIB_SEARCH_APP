import torch.nn as nn

class CRNN(nn.Module):
    def __init__(self, imgH, nc, nclass, nh):
        super(CRNN, self).__init__()
        assert imgH % 4 == 0, 'imgH must be multiple of 4'
        self.cnn = nn.Sequential(
            nn.Conv2d(nc, 64, 3, 1, 1), nn.ReLU(True), nn.BatchNorm2d(64),
            nn.Conv2d(64, 128, 3, 1, 1), nn.ReLU(True), nn.BatchNorm2d(128),
            nn.MaxPool2d((2, 1)),       # chỉ giảm chiều cao
            nn.Conv2d(128, 256, 3, 1, 1), nn.ReLU(True), nn.BatchNorm2d(256),
            nn.Conv2d(256, 256, 3, 1, 1), nn.ReLU(True), nn.BatchNorm2d(256),
            nn.MaxPool2d((2, 1)),       # height còn 1/4
            nn.Conv2d(256, 512, 3, 1, 1), nn.ReLU(True), nn.BatchNorm2d(512),
            nn.AdaptiveAvgPool2d((1, None))  # height = 1
        )
        self.rnn = nn.LSTM(512, nh, bidirectional=True, batch_first=True)
        self.fc = nn.Linear(nh * 2, nclass)

    def forward(self, x):
        conv = self.cnn(x)
        b, c, h, w = conv.size()
        assert h == 1, f'Expected height=1 but got {h}'
        conv = conv.squeeze(2).permute(0, 2, 1)  # (B, W, C)
        rec, _ = self.rnn(conv)
        out = self.fc(rec).log_softmax(2)
        return out