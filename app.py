from flask import Flask
from dotenv import load_dotenv

from google.cloud import firestore, storage

from modules.users import user_bp
from modules.admin import admin_bp
import os

load_dotenv()

app = Flask(__name__,
            template_folder='modules/view',)

app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', os.urandom(24))

firebase_service_account_path = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY_PATH')
firebase_project_ID = os.environ.get('FIREBASE_PROJECT_ID')
firebase_storage_bucket = os.environ.get('FIREBASE_STORAGE_BUCKET')


app.extensions['db'] = None
app.extensions['bucket'] = None

db = None
storage_instance = None
bucket = None

if firebase_service_account_path and os.path.exists(firebase_service_account_path):
    try:
        if firebase_project_ID:
            db = firestore.Client.from_service_account_json(firebase_service_account_path)
        if firebase_storage_bucket:
            storage_instance = storage.Client.from_service_account_json(firebase_service_account_path)
        if firebase_storage_bucket and storage_instance:
            bucket = storage_instance.bucket(firebase_storage_bucket)
        print("Firebase initialized successfully.")
    except Exception as e:
        print(e)


if db:
    app.extensions['db'] = db
if bucket:
    app.extensions['bucket'] = bucket

app.register_blueprint(admin_bp)
app.register_blueprint(user_bp)


    
if __name__ == '__main__':
    app.run(debug=True, port=5000, host = '0.0.0.0')