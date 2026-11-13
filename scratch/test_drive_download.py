import requests
import re

url = 'https://drive.google.com/file/d/1bgSFY95qx9olIatLM7Givxx22mWR0iOf/view?usp=sharing'
file_id = re.search(r'(?:/d/|id=)([a-zA-Z0-9_-]+)', url).group(1)

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

session = requests.Session()
session.headers.update(headers)

# Test usercontent url with confirm
uc_url = f'https://drive.usercontent.google.com/download?id={file_id}&export=download&confirm=t'
resp = session.get(uc_url)
print('Usercontent status:', resp.status_code, 'Content-Type:', resp.headers.get('Content-Type'), 'Size:', len(resp.content))
if resp.content.startswith(b'%PDF'):
    print('SUCCESS: Found PDF header!')
elif resp.content.startswith(b'PK'):
    print('SUCCESS: Found Excel/ZIP header!')
else:
    print('First 100 bytes:', resp.content[:100])
