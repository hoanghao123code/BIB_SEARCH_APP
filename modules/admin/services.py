from werkzeug.utils import secure_filename
from flask import current_app
from google.cloud.firestore_v1.base_query import FieldFilter
import zipfile
import  os
import cv2
import bcrypt
from google.cloud import firestore

from ai_processers.bib_detectors import detetct_bibs_yolov8
from ai_processers.bib_recognizer import recognize_bib_crnn


def get_db_bucket():
    db = current_app.extensions.get('db')
    bucket = current_app.extensions.get('bucket')
    return db, bucket


def authentication_admin_user(username, password):
    db, bucket = get_db_bucket()
    if not db:
        print("Firestore client chưa được khởi tạo")
        return None
    try:
        user_ref = db.collection('users')
        all_users = user_ref.get()
        query_admin = user_ref.where(filter=FieldFilter("username", "==", username)).where(filter=FieldFilter("role", "==", "admin")).limit(1)
        query_user = user_ref.where(filter=FieldFilter("username", "==", username)).where(filter=FieldFilter("role", "==", "user")).limit(1)
        results_admin = list(query_admin.stream())
        results_user = list(query_user.stream())
        print(results_admin, results_user)
        if not results_admin and not results_user:
            print("Không tìm thấy người dùng nào với tên đăng nhập này")
            return None
        if results_admin:
            admin_doc = results_admin[0]
            admin_data = admin_doc.to_dict()
            admin_id = admin_doc.id
            print("pass admin")
            if admin_data and "password_hash" in admin_data:
                store_hash = admin_data["password_hash"].encode('utf-8')
                # print(store_hash)
                if bcrypt.checkpw(password.encode('utf-8'), store_hash):
                    return {
                        "id": admin_id,
                        "username": username,
                        "role": "admin"
                    }
        else:
            print("pass_user")
            user_doc = results_user[0]
            user_data = user_doc.to_dict()
            user_id = user_doc.id
            if user_data and "password_hash" in user_data:
                store_hash = user_data["password_hash"].encode('utf-8')
                print(store_hash)
                if bcrypt.checkpw(password.encode('utf-8'), store_hash):
                    return {
                        "id": user_id,
                        "username":username,
                        "role": "user"
                    }
        return None

    except Exception as e:
        return None


def hash_password(password):
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def generate_subsequences(bib):
    bib_str = str(bib).strip().upper()
    n = len(bib_str)
    sequences = []
    for i in range((1 << n)):
        bib_seq = ""
        for j in range(n):
            if i & (1 << j):
                bib_seq += bib_str[j]
        if len(bib_seq) >= 4 and len(bib_seq) <= 6:
            sequences.append(bib_seq)
    return sequences

dataset_folder = "images_dataset"

if not os.path.exists(dataset_folder):
    os.makedirs(dataset_folder)

allowed_extension = {'png', 'jpg', 'jpeg', 'gif', 'tiff'}

def allowed_file(file_name):
    return '.' in file_name and \
            file_name.rsplit('.', 1)[1].lower() in allowed_extension

def upload_folder_zip_service(zip_storage, race_event_name):
    db, bucket = get_db_bucket()

    if not db or not bucket:
        print("Firestore client chưa được khởi tạo")
        return "Lỗi hệ thống", 500
    
    if not zip_storage or zip_storage.filename == "":
        return "Không có file zip nào được chọn", 400
    if not race_event_name or not race_event_name.strip():
        return "Vui lòng nhập tên giải chạy", 400
    race_event_name_cleaned = race_event_name.strip()
    race_event_name_normalized = race_event_name_cleaned.lower().replace(" ", "_").replace("đ", "d").replace("'", "").replace('"', "")
    all_moments = set()
    if zip_storage and zip_storage.filename.lower().endswith('.zip'):
        ori_file = secure_filename(zip_storage.filename)
        extract_folder = os.path.join(dataset_folder, race_event_name_normalized)
        os.makedirs(extract_folder, exist_ok=True)

        zip_path = os.path.join(dataset_folder, ori_file)
        zip_storage.save(zip_path)
        processed_files_count = 0
        failed_files_count = 0

        event_doc = db.collection('RaceEvents').document(race_event_name_normalized)
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_r:
                zip_r.extractall(extract_folder)
            root_folder = [p for p in os.listdir(extract_folder)
                           if os.path.isdir(os.path.join(extract_folder, p))]
            
            if not root_folder:
                raise Exception("No found folder in ZIP file")
            
            old_event_path = extract_folder
            save_event_name = secure_filename(race_event_name)
            new_event_path = os.path.join(dataset_folder, save_event_name)

            if not os.path.exists(new_event_path) and os.path.exists(old_event_path):
                os.rename(old_event_path, new_event_path)
            child_folder = new_event_path
            for moment in os.listdir(child_folder):
                moment_path = os.path.join(child_folder, moment)
                all_moments.add(moment)

                save_moment_name = secure_filename(moment)
                new_moment_path = os.path.join(new_event_path, save_moment_name)
                if not os.path.exists(new_moment_path):
                    os.rename(moment_path, new_moment_path)

                for fname in os.listdir(new_moment_path):
                    img_path = os.path.join(new_moment_path, fname)
                    if os.path.isfile(img_path) and allowed_file(fname):
                        try:
                            detect_bib_number = []
                            img = cv2.imread(img_path)
                            if img is not None:
                                box, cropped_bibs = detetct_bibs_yolov8(img_path)
                                for bib in cropped_bibs:
                                    recognize_text = recognize_bib_crnn(bib)
                                    if recognize_text != "" and len(recognize_text) > 3:
                                        detect_bib_number.append(recognize_text)
                            else:
                                failed_files_count += 1
                            save_file_name = secure_filename(fname)
                            relative_img_path = os.path.join(save_event_name, save_moment_name, save_file_name)
                            
                            if len(detect_bib_number) != 0:
                                bib_sequences = set()
                                for bib in detect_bib_number:
                                    sequences = generate_subsequences(bib)
                                    bib_sequences.update(sequences)
                                image_doc = {
                                    'race_event_name': race_event_name_cleaned,
                                    'race_event_ref': race_event_name_normalized,
                                    'image_url': relative_img_path,
                                    'moment_name': moment,
                                    'bib_detected':[str(bib).strip().upper() for bib in detect_bib_number if str(bib).strip()],
                                    'bib_subsequences': list(bib_sequences),
                                    'original_name': fname,
                                    'created_at': firestore.SERVER_TIMESTAMP
                                }
                                db.collection('RaceEventsImages').add(image_doc)
                            processed_files_count += 1
                        except Exception as e:
                            failed_files_count += 1
                            print(f"Error processing {img_path}: {e}")
            event_doc_snapshot = event_doc.get()
            if not event_doc_snapshot.exists:
                event_doc.set({
                    'event_name':race_event_name_cleaned,
                    'moment_name': list(all_moments),
                    'cover_image_url': "cover_image_url",
                    'images_count': firestore.Increment(processed_files_count),
                    'created_at': firestore.SERVER_TIMESTAMP
                })
            else:
                event_doc.update({
                    'moment_name': firestore.ArrayUnion(list(all_moments)),
                    'images_count': firestore.Increment(processed_files_count),
                    'updated_at': firestore.SERVER_TIMESTAMP
                })
            final_message = f"{processed_files_count} xử lí thành công ."
            final_message += f"{failed_files_count} xử lí không thành công"
            return final_message, 200
        except Exception as e:
            return "Invalid Zipfile", 400
    return "Invalid file type please upload .zip file", 400

def is_password_use(password):
    db, bucket = get_db_bucket()
    if not db:
        print("Firestore client chưa được khởi tạo")
        return False
    users = db.collection('users').get()
    if not users:
        print("Không tìm thấy người dùng nào trong Firestore")
        False
    for user in users:
        user_data = user.to_dict()
        if "password_hash" in user_data and user_data["password_hash"]:
            store_hash = user_data["password_hash"].encode('utf-8')
            if bcrypt.checkpw(password.encode('utf-8'), store_hash):
                return True
    return False

def create_user_service(username, password, role, email):
    db, bucket = get_db_bucket()
    if not db:
        print("Firestore client chưa được khởi tạo")
        return "Lỗi hệ thống", 500
    
    query_username = db.collection('users').where("username", "==", username).limit(1)
    results = list(query_username.stream())
    if results:
        return "Tên người dùng đã tồn tại", 400
    
    
    hashed_password = hash_password(password)
    user_doc = {
        'username': username,
        'password_hash': hashed_password,
        'role': role,
        'created_at': firestore.SERVER_TIMESTAMP
    }
    try:
        db.collection('users').add(user_doc)
        return "Tạo người dùng thành công", 200
    except Exception as e:
        print(e)
        return "Lỗi khi tạo người dùng", 500
    
def upload_cover_service(racename, filepath):
    db, _ = get_db_bucket()
    if not db:
        print("Firestore client chưa được khởi tạo")
        return 400, "Lỗi hệ thống"
    try:
        race_ref = db.collection("RaceEvents").where(filter=FieldFilter('event_name', '==', racename)).limit(1).get()
        if race_ref:
            race_doc = race_ref[0]
            old_filepath = race_doc.get('cover_image_url')
            root_dataset = os.environ.get('IMAGES_DATASET_FOLDER', 'images_dataset')
            root_path = os.path.join(root_dataset, old_filepath)
            # print(os.path.exists(root_path))
            if (os.path.exists(root_path)):
                os.remove(root_path)
            race_doc.reference.update({
                'cover_image_url': filepath
            })
            # print("pass")
            return 200, f"Lưu ảnh bìa cho giải {racename} thành công"
        return 400, f"Tải ảnh bìa thất bại"
    except Exception as e:
        return 400, f"Tải ảnh bìa cho giải {racename} thất bại"

def manage_images_service():
    db, _ = get_db_bucket()
    if not db:
        return 400, [], [], []
    try:
        all_races = [doc.to_dict() for doc in db.collection("RaceEvents").get()]
        images = [{"id": doc.id, **doc.to_dict()} for doc in db.collection("RaceEventsImages").limit(15).get()]  # Lấy 15 ảnh ban đầu
        total_images = db.collection("RaceEventsImages").count().get()[0][0].value
        return 200, all_races, images, total_images
    except Exception as e:
        return 400, [], [], []
    
def delete_image_service(image_id):
    db, _ = get_db_bucket()
    if not db:
        return 400, "Lỗi db"
    try:
        db.collection("RaceEventsImages").document(image_id).delete()
        return 200, "Xoá ảnh thành công"
    except Exception as e:
        return 400, "Xoá ảnh thất bại"
    
def manage_races_service():
    db, _ = get_db_bucket()
    if not db:
        return 400, []
    races = []
    try:
        query = db.collection("RaceEvents").get()
        for doc in query:
            data = doc.to_dict()
            data['id'] = doc.id
            races.append(data)
        return 200, races
    except Exception as e:
        return 400, []
    
def delete_race_service(event_name):
    db, _ = get_db_bucket()
    if not db:
        return 400, "Lỗi db"
    try:
        query_event = db.collection('RaceEvents').where(filter=FieldFilter('event_name', '==', event_name)).get()
        if not query_event:
            return 400, f"Không tìm thấy giải chạy {event_name}"
        for doc in query_event:
            doc.reference.delete()
        query_event_images = db.collection('RaceEventsImages').where(filter=FieldFilter('race_event_name', '==', event_name)).get()
        if query_event_images:
            for doc in query_event_images:
                doc.reference.delete()
        dataset_folder = os.environ.get("UPLOADED_IMAGES_DIR", "images_dataset")
        save_event_name = secure_filename(event_name)
        event_folder = os.path.join(dataset_folder, save_event_name)
        if os.path.exists(event_folder):
            os.remove(event_folder)
        return 200, f"Xoá giải chạy {event_name} thành công"
    except Exception as e:
        return 400, "Xoá giải chạy thất bại"
    

def update_race_service(race_name, new_race_name, location, date, cover_image=None):
    db, _ = get_db_bucket()
    if not db:
        return 400, "Lỗi db"
    try:
        query = db.collection("RaceEvents").where(filter=FieldFilter('event_name', '==', race_name)).limit(1).get()
        if not query:
            return 400, f"Không tìm thấy giải chạy {race_name}"
        
        doc = query[0]
        doc_ref = doc.reference
        update_race = {
            'event_name': new_race_name,
            'location': location,
            'create_at': date
        }
        # print(race_name)
        doc_ref.update(update_race)
        if cover_image and cover_image.filename:
            filename = secure_filename(cover_image.filename)
            filepath = os.path.join('cover_event', f"{new_race_name}_{filename}")
            dataset_folder = os.environ.get("UPLOADED_IMAGES_DIR", "images_dataset")
            file_save = os.path.join(dataset_folder, filepath)
            cover_image.save(file_save)
            doc_ref.update({'cover_image_url': filepath})
        query_update = db.collection("RaceEventsImages").where(filter=FieldFilter('race_event_name', '==', race_name)).get()
        if query_update:
            new_race_name_cleaned = new_race_name.strip()
            race_name_normalized = new_race_name_cleaned.lower().replace(" ", "_").replace("đ", "d").replace("'", "").replace('"', "")
            for doc in query_update:
                doc.reference.update({
                    'race_event_name': new_race_name,
                    'race_event_ref': race_name_normalized})
        return 200, f"Cập nhật thông tin giải chạy {race_name} thành công"
    except Exception as e:
        return 400, f"Cập nhật thông tin giải chạy {race_name} không thành công"

def get_moment_service(race_name):
    db, _ = get_db_bucket()
    if not db or not race_name:
        return [], "db hoặc tên giải không hợp lệ"
    try:
        query = db.collection('RaceEvents').where(filter=FieldFilter
        ('event_name', '==', race_name)).limit(1)
        results = list(query.stream())
        if results:
            results = list(results[0].to_dict().get('moment_name', []))
            results.sort()
            # print(results)
            return results, None
        else:
            print("Không tìm thấy giải chạy nào với tên này")
            return [], "Không tìm thấy giải chạy"
    except Exception as e:
        return [], str(e)
    
def search_image_service(race_event_filter, moment_filter, last_doc_id, per_page):
    db, _ = get_db_bucket()
    if not db:
        return 400, [], [], None
    try:
        query = db.collection("RaceEventsImages")
        if race_event_filter and race_event_filter != "all":
            query = query.where(filter=FieldFilter('race_event_name', '==', race_event_filter))
        if moment_filter and moment_filter != "all":
            query = query.where(filter=FieldFilter('moment_name', '==', moment_filter))
        if last_doc_id:
            last_doc = db.collection("RaceEventsImages").document(last_doc_id).get()
            if last_doc.exists:
                query = query.start_after(last_doc)
        per_page = int(per_page)
        images = [{"id": doc.id, **doc.to_dict()} for doc in query.limit(per_page).get()]
        total_images = db.collection("RaceEventsImages").count().get()[0][0].value
        last_doc_id = images[-1]["id"] if images else None
        return 200, images, total_images, last_doc_id
    except Exception as e:
        return 400, [], [], None
    
def manage_user_service():
    db, _ = get_db_bucket()
    if not db:
        return 400, [], 0
    try:
        docs = db.collection("users").order_by("created_at").get()
        users = [{"id": doc.id, **doc.to_dict()} for doc in docs]
        print("pass")
        return 200, users, len(users)
    except Exception as e:
        return 400, [], 0
    
def search_user_service(role, page, per_page, last_doc_id):
    db, _ = get_db_bucket()
    if not db:
        return 400, [], 0
    try:
        query = db.collection("users")
        if role:
            query = query.where(filter=FieldFilter('role', '==', role))
        # print(role, query.get('role'))
        total_users = len(query.get())
        if last_doc_id:
            last_doc = db.collection("users").document(last_doc_id).get()
            if last_doc.exists:
                query = query.start_after(last_doc)
        query = query.limit(per_page)
        users = [{"id": doc.id, **doc.to_dict()} for doc in query.get()]
        last_doc_id = users[-1]["id"] if users else None
        return 200, users, total_users
    except Exception as e:
        return 400, [], 0


def update_user_service(user_id, user_name, email, role):
    db, _ = get_db_bucket()
    if not db:
        return 400, "Lỗi db"
    if not user_id or not user_name or not email or not role:
        return 400, "Phải điền đầy đủ thông tin"
    try:
        user_ref = db.collection("users").document(user_id)
        if not user_ref.get().exists:
            return 400, "Không tìm thấy user"
        user_ref.update({
            "username": user_name,
            "role": role,
            "email": email,
        })
        return 200, "Cập nhật user thành công"
    except Exception as e:
        return 400, "Cập nhật user không thành công"
    
def change_password_service(user_id, newpassword):
    db, _ = get_db_bucket()
    if not db:
        return 400, "Lỗi db"
    try:
        user_ref = db.collection("users").document(user_id)
        if not user_ref.get().exists:
            return 400, "Không tồn tại user"
        password_hash = hash_password(newpassword)
        user_ref.update({
            "password_hash": password_hash
        })
        return 200, "Đổi mật khẩu thành công"
    except Exception as e:
        return 400, "Đổi mật khẩu không thành công"

def delete_user_service(user_id):
    db, _ = get_db_bucket()
    if not db:
        return 400, "Lỗi db"
    try:
        user_ref = db.collection("users").document(user_id)
        if not user_ref.get().exists:
            return 400, "Không tìm thấy user cần xoá"
        user_ref.delete()
        return 200, f"Xoá user {user_ref.get('username', '')} thành công"
    except Exception as e:
        return 400, "Xoá user không thành công"
