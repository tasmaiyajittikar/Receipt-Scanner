import re
from typing import List, Dict
import pytesseract
from PIL import Image

# If you don't have tesseract installed in your computer, download it from here: 
# https://github.com/UB-Mannheim/tesseract/wiki
# Set the correct path to your tesseract executable
# For Windows, it is usually: r'C:\Program Files\Tesseract-OCR\tesseract.exe'
# For Linux/Mac, it is usually just: 'tesseract'
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def extract_receipt_data(image_path: str) -> Dict:
    """
    Extracts receipt data from an image file and returns structured information.
    
    Args:
        image_path (str): Path to the receipt image file
        
    Returns:
        Dict: Structured receipt data including items, totals, and metadata
    """
    # Load the image and extract text using OCR
    img = Image.open(image_path)
    text = pytesseract.image_to_string(img)
    
    # Initialize result dictionary
    result = {
        "store_info": {},
        "transaction_info": {},
        "items": [],
        "totals": {},
        "payment_info": {},
        "customer_info": {}
    }
    
    # Split text into lines
    lines = text.split('\n')
    
    # Process each line to extract relevant information
    for line in lines:
        line = line.strip()
        
        # Extract store information
        if not result["store_info"].get("name") and line:
            result["store_info"]["name"] = line
        
        # Extract address if pattern matches
        if re.match(r'\d{4} [A-Z]{2}-\d{2}', line):
            result["store_info"]["address"] = line
        
        # Extract invoice number
        if line.startswith("Invoice No.:"):
            result["transaction_info"]["invoice_no"] = line.split(":")[1].strip()
        
        # Extract date/time
        if line.startswith("Date/Time:"):
            result["transaction_info"]["date_time"] = line.split(":", 1)[1].strip()
        
        # Extract cashier information
        if line.startswith("Cashier:"):
            result["transaction_info"]["cashier"] = line.split(":", 1)[1].strip()
        
        # Extract item information
        item_match = re.match(r'(\d+\.\d+LB|\d+) (.+?) (\d+\.\d+|\d+) \s*\$(\d+\.\d+)', line)
        if item_match:
            quantity, name, unit_price, price = item_match.groups()
            result["items"].append({
                "name": name.strip(),
                "quantity": quantity,
                "unit_price": f"${unit_price}",
                "price": f"${price}"
            })
        
        # Extract totals
        if "Grand Total" in line:
            total_match = re.search(r'\$(\d+\.\d+)', line)
            if total_match:
                result["totals"]["grand_total"] = f"${total_match.group(1)}"
        
        # Extract payment information
        if line.startswith("CREDIT CARD PURCHASE:"):
            result["payment_info"]["amount"] = line.split(":")[1].strip()
        if line.startswith("Card:"):
            result["payment_info"]["card_last4"] = line.split(":")[1].strip()
        
        # Extract customer information
        if line.startswith("Customer:"):
            result["customer_info"]["name"] = line.split(":")[1].strip()
        if line.startswith("Phone:"):
            result["customer_info"]["phone"] = line.split(":")[1].strip()
    
    return result

def display_as_table(data: Dict):
    """
    Displays the extracted receipt data in a tabular format.
    
    Args:
        data (Dict): Structured receipt data
    """
    # Print store information
    print("\nSTORE INFORMATION")
    print("-----------------")
    print(f"Store Name: {data['store_info'].get('name', 'N/A')}")
    print(f"Address: {data['store_info'].get('address', 'N/A')}")
    
    # Print transaction information
    print("\nTRANSACTION INFORMATION")
    print("-----------------------")
    print(f"Invoice No.: {data['transaction_info'].get('invoice_no', 'N/A')}")
    print(f"Date/Time: {data['transaction_info'].get('date_time', 'N/A')}")
    print(f"Cashier: {data['transaction_info'].get('cashier', 'N/A')}")
    
    # Print items in a table
    print("\nITEMS PURCHASED")
    print("--------------")
    print(f"{'Name':<30} {'Quantity':<10} {'Unit Price':<12} {'Price':<10}")
    print("-" * 62)
    for item in data['items']:
        print(f"{item['name'][:28]:<30} {item['quantity']:<10} {item['unit_price']:<12} {item['price']:<10}")
    
    # Print totals
    print("\nTOTALS")
    print("------")
    print(f"Grand Total: {data['totals'].get('grand_total', 'N/A')}")
    
    # Print payment information
    print("\nPAYMENT INFORMATION")
    print("-------------------")
    print(f"Amount: {data['payment_info'].get('amount', 'N/A')}")
    print(f"Card (last 4): {data['payment_info'].get('card_last4', 'N/A')}")
    
    # Print customer information
    print("\nCUSTOMER INFORMATION")
    print("--------------------")
    print(f"Name: {data['customer_info'].get('name', 'N/A')}")
    print(f"Phone: {data['customer_info'].get('phone', 'N/A')}")

# Example usage
if __name__ == "__main__":
    # Replace with your image path
    image_path = "image2.jpeg"
    
    try:
        extracted_data = extract_receipt_data(image_path)
        display_as_table(extracted_data)
    except Exception as e:
        print(f"Error processing receipt: {e}")