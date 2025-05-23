FROM python:3.10.12-slim

# Cài đặt các gói hệ thống cần thiết
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Thiết lập thư mục làm việc
WORKDIR /app

# Copy requirements.txt và cài đặt các thư viện Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy mã nguồn của dự án
COPY . .

# Cấu hình lệnh chạy ứng dụng
CMD ["python", "app.py"]