import os
import json

SUPPORTED_EXTENSIONS = {
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.zip': 'application/zip',
    '.aup3': 'application/octet-stream',
}

def upload_audio_to_r2():
    # 1. Fast Check: Scan local files and compare with cache to see if any uploads are actually needed.
    cache_path = './dev/.r2_cache.json'
    cache = {}
    if os.path.exists(cache_path):
        try:
            with open(cache_path, 'r') as f:
                cache = json.load(f)
        except Exception:
            pass

    has_changes = False
    for root, dirs, files in os.walk('./public/content'):
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in SUPPORTED_EXTENSIONS:
                local_path = os.path.join(root, file)
                mtime = os.path.getmtime(local_path)
                if local_path not in cache or cache[local_path] != mtime:
                    has_changes = True
                    break
        if has_changes:
            break

    if not has_changes:
        print("✅ No new media or project files found. Cache is up to date.")
        return

    # 2. Files changed; proceed with R2 upload credentials & setup
    secrets_path = './dev/.r2_secrets.json'
    if not os.path.exists(secrets_path):
        print("⚠️ R2 Upload: Missing credentials (dev/.r2_secrets.json). Cannot upload.")
        return
        
    try:
        with open(secrets_path, 'r') as f:
            secrets = json.load(f)
    except Exception as e:
        print(f"⚠️ R2 Upload: Failed to load local secrets: {e}")
        return
        
    account_id = secrets.get("account_id")
    access_key_id = secrets.get("access_key_id")
    secret_access_key = secrets.get("secret_access_key")
    bucket_name = "ryanmarchdotme-media"
    
    if not all([account_id, access_key_id, secret_access_key]):
        print("⚠️ R2 Upload: Missing credentials in local secrets file.")
        return
        
    try:
        import boto3
        from boto3.s3.transfer import TransferConfig
        from botocore.config import Config
    except ImportError:
        print("⚠️ R2 Upload: boto3 library not installed locally.")
        print("👉 Please run: python3 -m pip install boto3")
        return
        
    print("🎙️ R2 Upload: Checking and uploading media/project files to R2...")
            
    try:
        r2 = boto3.client(
            service_name='s3',
            endpoint_url=f'https://{account_id}.r2.cloudflarestorage.com',
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            config=Config(
                signature_version='s3v4',
                connect_timeout=30,
                read_timeout=300,
                retries={'max_attempts': 5, 'mode': 'standard'}
            )
        )
    except Exception as e:
        print(f"⚠️ R2 Upload: Failed to initialize R2 client: {e}")
        return
        
    uploaded_any = False
    
    transfer_config = TransferConfig(
        multipart_threshold=8 * 1024 * 1024,
        max_concurrency=4,
        multipart_chunksize=8 * 1024 * 1024,
        use_threads=True
    )
    
    for root, dirs, files in os.walk('./public/content'):
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in SUPPORTED_EXTENSIONS:
                local_path = os.path.join(root, file)
                mtime = os.path.getmtime(local_path)
                
                if local_path not in cache or cache[local_path] != mtime:
                    print(f"⬆️ Uploading {file} to R2...")
                    try:
                        content_type = SUPPORTED_EXTENSIONS[ext]
                        r2.upload_file(
                            Filename=local_path,
                            Bucket=bucket_name,
                            Key=file,
                            Config=transfer_config,
                            ExtraArgs={'ContentType': content_type}
                        )
                        cache[local_path] = mtime
                        uploaded_any = True
                        print(f"✅ Successfully uploaded {file}")
                    except Exception as e:
                        print(f"⚠️ Failed to upload {file}: {e}")
                        
    if uploaded_any:
        try:
            with open(cache_path, 'w') as f:
                json.dump(cache, f)
        except Exception:
            pass

if __name__ == "__main__":
    upload_audio_to_r2()
