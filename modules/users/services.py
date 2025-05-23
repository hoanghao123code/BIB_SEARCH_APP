from flask import current_app
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

def get_db_bucket():
    db = current_app.extensions.get('db')
    bucket = current_app.extensions.get('bucket')
    return db, bucket

def get_all_event(page=1, per_page=21):
    db, bucket = get_db_bucket()
    if not db:
        return [], 0, "Firestore client chưa được khởi tạo"
    try:
        event_ref = db.collection('RaceEvents').order_by('event_name', direction=firestore.Query.ASCENDING)
        total_races = event_ref.count().get()[0][0].value
        # print(total_races)
        # Phân trang sử dụng start after
        query = event_ref.limit(per_page)
        if page > 1:
            prev_page_query = event_ref.limit((page - 1) * per_page)
            docs = list(prev_page_query.stream())
            if not docs:
                return [], total_races, "Không có dữ liệu cho trang yêu cầu"
            last_docs = docs[-1]
            query = query.start_after(last_docs).limit(per_page)
        else:
            query = query.limit(per_page)

        docs = query.stream()
        races = []
        for doc in docs:
            doc_data = doc.to_dict()
            date = doc_data.get('created_at')
            if isinstance(date, firestore.DocumentReference):
                date = None
            races.append({
                'id': doc.id,
                'name': doc_data.get('event_name', 'N/A'),
                'cover_image_url': doc_data.get('cover_image_url', ''),
                'date': date or 'N/A',
                'location': doc_data.get('location', 'N/A')
            })
        if races:
            print(f"Lấy {len(races)} giải chạy thành công, trang {page}, tổng {total_races}")
        else:
            print(f"Không tìm thấy giải chạy nào ở trang {page}")
        return races, total_races, None        
    except Exception as e:  
        print(f"Lỗi khi lấy danh sách giải chạy: {str(e)}")
        return [], 0, str(e)

    
def get_moment_for_event(event_name):
    db, bucket = get_db_bucket()
    if not db or not event_name:
        return [], "db hoặc tên giải không hợp lệ"
    try:
        query = db.collection('RaceEvents').where(filter=FieldFilter
        ('event_name', '==', event_name)).limit(1)
        results = list(query.stream())
        if results:
            return results[0].to_dict().get('moment_name', []), None
        else:
            print("Không tìm thấy giải chạy nào với tên này")
            return [], "Không tìm thấy giải chạy"
    except Exception as e:
        return [], str(e)

    

def search_images_service(bib_number, race_event_filter="all", 
                          moment_filter="all", page=1, per_page=21):
    db, bucket = get_db_bucket()
    if not db:
        return [], 0, None
    try:
        query = db.collection('RaceEventsImages')

        if race_event_filter != "all" and race_event_filter:
            query = query.where(filter=FieldFilter('race_event_name', '==', race_event_filter))

        bib_query = str(bib_number).strip().upper()
        if bib_query:
            query = query.where(filter=FieldFilter('bib_subsequences', 'array_contains', bib_query))
        
        if moment_filter != "all" and moment_filter:
            query = query.where(filter=FieldFilter('moment_name', '==', moment_filter)) 

        should_excute_query = bool(bib_query) or (race_event_filter != "all" and race_event_filter) 
        if not should_excute_query:
            print("Không có điều kiện tìm kiếm nào")
            return [], 0, "Vui lòng cung cấp só BIB hoặc giải chạy cụ thể"
        
        total_images = query.count().get()[0][0].value
        if page > 1:
            prev_page_query = query.limit((page - 1) * per_page)
            docs = list(prev_page_query.stream())
            if not docs:
                return [], total_images, "Không có dữ liệu cho trang yêu cầu"
            last_docs = docs[-1]
            query = query.start_after(last_docs).limit(per_page)
        else:
            query = query.limit(per_page)
        docs = query.stream()
        results = []
        for doc in docs:
            data = doc.to_dict()
            results.append({
                "image_url": data.get('image_url', ''),
                "moment_name": data.get('moment_name', 'N/A'),
                "race_event_name": data.get('race_event_name', "N/A"),
                'original_name': data.get('original_name', data.get('image_url', '').split('/')[-1]),
                "bibs": data.get('bib_detected', []),
            }) 
        return results, total_images, None
    except Exception as e:
        print("Lỗi khi tìm kiếm hình ảnh:", str(e))
        return [], 0, str(e)

