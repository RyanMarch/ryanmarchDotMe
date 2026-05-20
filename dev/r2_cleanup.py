import os
import json

def load_secrets():
    secrets_path = './dev/.r2_secrets.json'
    if not os.path.exists(secrets_path):
        print("❌ Error: dev/.r2_secrets.json not found.")
        print("This script must be run locally in the repository root directory.")
        return None
        
    try:
        with open(secrets_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Error loading secrets: {e}")
        return None

def get_local_audio_files():
    local_files = set()
    for root, dirs, files in os.walk('./content'):
        for file in files:
            if file.endswith('.mp3'):
                local_files.add(file)
    return local_files

def cleanup():
    print("🎙️ Starting Cloudflare R2 Safe Cleanup Utility...")
    
    secrets = load_secrets()
    if not secrets:
        return
        
    account_id = secrets.get("account_id")
    access_key_id = secrets.get("access_key_id")
    secret_access_key = secrets.get("secret_access_key")
    bucket_name = "ryanmarchdotme-media"
    
    if not all([account_id, access_key_id, secret_access_key]):
        print("❌ Error: Missing credentials in dev/.r2_secrets.json.")
        return
        
    try:
        import boto3
        from botocore.config import Config
    except ImportError:
        print("❌ Error: boto3 library not installed.")
        print("👉 Please run: python3 -m pip install boto3")
        return
        
    # Get local files
    local_files = get_local_audio_files()
    print(f"📁 Found {len(local_files)} local audio files on your computer.")
    
    try:
        r2 = boto3.client(
            service_name='s3',
            endpoint_url=f'https://{account_id}.r2.cloudflarestorage.com',
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            config=Config(signature_version='s3v4')
        )
    except Exception as e:
        print(f"❌ Failed to initialize R2 client: {e}")
        return
        
    print("🛰️ Connecting to Cloudflare R2 bucket...")
    try:
        response = r2.list_objects_v2(Bucket=bucket_name)
    except Exception as e:
        print(f"❌ Failed to list objects in bucket '{bucket_name}': {e}")
        return
        
    r2_files = []
    if 'Contents' in response:
        for obj in response['Contents']:
            key = obj['Key']
            if key.endswith('.mp3'):
                r2_files.append(key)
                
    print(f"☁️ Found {len(r2_files)} audio files in your Cloudflare R2 bucket.")
    
    # Find orphans (exist in R2 but NOT locally)
    orphans = [f for f in r2_files if f not in local_files]
    
    if not orphans:
        print("✨ Perfect! Your Cloudflare R2 bucket is fully clean. No orphaned files found.")
        return
        
    print(f"\n🔍 Found {len(orphans)} orphaned file(s) in R2 that no longer exist locally:")
    for orphan in orphans:
        print(f"  - {orphan}")
        
    print("\n⚠️ WARNING: Deleting these files will remove them permanently from Cloudflare R2.")
    print("If active pages or external sites link directly to these URLs, they will break.")
    
    confirm = input("\n👉 Would you like to delete these orphaned files from R2? (y/N): ").strip().lower()
    
    if confirm in ['y', 'yes']:
        print(f"\n🗑️ Deleting {len(orphans)} file(s) from R2...")
        deleted_count = 0
        
        # Deleting files
        for orphan in orphans:
            try:
                r2.delete_object(Bucket=bucket_name, Key=orphan)
                print(f"  ✅ Deleted {orphan}")
                deleted_count += 1
            except Exception as e:
                print(f"  ❌ Failed to delete {orphan}: {e}")
                
        # Clean up local cache file
        cache_path = './dev/.r2_cache.json'
        if os.path.exists(cache_path):
            try:
                with open(cache_path, 'r') as f:
                    cache = json.load(f)
                
                # Filter cache keys
                updated_cache = {k: v for k, v in cache.items() if os.path.basename(k) not in orphans}
                
                with open(cache_path, 'w') as f:
                    json.dump(updated_cache, f)
                print("📝 Local cache file updated successfully.")
            except Exception as e:
                print(f"⚠️ Failed to update local cache file: {e}")
                
        print(f"\n✨ Cleanup completed successfully! Removed {deleted_count} orphaned files.")
    else:
        print("\n❌ Cleanup cancelled. No files were deleted.")

if __name__ == "__main__":
    cleanup()
