# @title Firefox to Chrome HAR File Converter
# Install required libraries
!pip install -q ipywidgets

import json
import re
import os
from datetime import datetime
import io
from google.colab import files
import ipywidgets as widgets
from IPython.display import display, HTML

def convert_string_numbers_to_float(obj):
    """
    Convert numeric strings to float values
    """
    if isinstance(obj, dict):
        # Fields that should be numeric
        number_fields = [
            'time', 'timings', 'bodySize', 'headersSize', 'connect',
            'wait', 'receive', 'send', 'ssl', 'blocked', 'dns', 'compression', 'size'
        ]

        for key, value in list(obj.items()):
            if key in number_fields and isinstance(value, str):
                try:
                    # Convert to float or integer
                    if value.strip() == "":
                        obj[key] = 0
                    else:
                        obj[key] = float(value)
                except ValueError:
                    # Set to zero if conversion fails
                    obj[key] = 0
            elif isinstance(value, (dict, list)):
                obj[key] = convert_string_numbers_to_float(value)

    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            obj[i] = convert_string_numbers_to_float(item)

    return obj

def ensure_required_fields(har_data):
    """
    Ensure all required fields exist
    """
    # Ensure main structure exists
    if 'log' not in har_data:
        har_data['log'] = {}

    if 'creator' not in har_data['log']:
        har_data['log']['creator'] = {
            'name': 'Firefox',
            'version': 'unknown',
            'comment': 'Converted by Firefox HAR Converter'
        }

    if 'entries' not in har_data['log']:
        har_data['log']['entries'] = []

    # Fix each entry
    for entry in har_data['log']['entries']:
        # Ensure required fields exist
        if 'request' not in entry:
            entry['request'] = {}

        if 'response' not in entry:
            entry['response'] = {}

        if 'timings' not in entry:
            entry['timings'] = {
                'blocked': 0,
                'dns': 0,
                'connect': 0,
                'ssl': 0,
                'send': 0,
                'wait': 0,
                'receive': 0
            }
        else:
            # Ensure all timing fields exist
            for timing in ['blocked', 'dns', 'connect', 'ssl', 'send', 'wait', 'receive']:
                if timing not in entry['timings']:
                    entry['timings'][timing] = 0

        # Fix negative or invalid values
        for key, value in entry['timings'].items():
            if value is None or (isinstance(value, (int, float)) and value < 0):
                entry['timings'][key] = 0

    return har_data

def fix_timestamps(har_data):
    """
    Fix timestamp format
    """
    for entry in har_data['log']['entries']:
        if 'startedDateTime' in entry and isinstance(entry['startedDateTime'], (int, float)):
            # Convert numeric timestamp to ISO format
            timestamp = entry['startedDateTime']
            try:
                dt = datetime.fromtimestamp(timestamp / 1000)  # If in milliseconds
                entry['startedDateTime'] = dt.isoformat() + 'Z'
            except:
                try:
                    dt = datetime.fromtimestamp(timestamp)  # If in seconds
                    entry['startedDateTime'] = dt.isoformat() + 'Z'
                except:
                    # Fallback to current time on error
                    entry['startedDateTime'] = datetime.now().isoformat() + 'Z'

    return har_data

def fix_mime_types(har_data):
    """
    Fix MIME types
    """
    for entry in har_data['log']['entries']:
        if 'response' in entry and 'content' in entry['response']:
            if 'mimeType' not in entry['response']['content']:
                entry['response']['content']['mimeType'] = 'application/octet-stream'
            elif entry['response']['content']['mimeType'] == '':
                entry['response']['content']['mimeType'] = 'application/octet-stream'

    return har_data

def fix_har_file(har_data):
    """
    Fix Firefox HAR file to make it compatible with Chrome
    """
    try:
        # Apply all fixes
        har_data = convert_string_numbers_to_float(har_data)
        har_data = ensure_required_fields(har_data)
        har_data = fix_timestamps(har_data)
        har_data = fix_mime_types(har_data)

        return har_data, True

    except Exception as e:
        return None, f"Error fixing HAR file: {str(e)}"

# Upload file
print("Please upload your Firefox HAR file:")
uploaded = files.upload()

if uploaded:
    for filename, content in uploaded.items():
        if filename.endswith('.har'):
            try:
                # Read file content
                har_content = content.decode('utf-8')
                har_data = json.loads(har_content)

                # Fix the HAR file
                fixed_har, result = fix_har_file(har_data)

                if isinstance(result, bool) and result:
                    # Set output filename
                    output_filename = os.path.splitext(filename)[0] + "_chrome_compatible.har"

                    # Save fixed file for download
                    with open(output_filename, 'w', encoding='utf-8') as f:
                        json.dump(fixed_har, f, indent=2)

                    print(f"File successfully fixed. Click to download:")
                    files.download(output_filename)
                else:
                    print(f"Error fixing file: {result}")
            except Exception as e:
                print(f"Error processing file: {str(e)}")
        else:
            print("Please upload a .har file.")
else:
    print("No file uploaded.")