// DOM Elements
const receiptUpload = document.getElementById('receiptUpload');
const preview = document.getElementById('preview');
const processBtn = document.getElementById('processBtn');
const storeInfo = document.getElementById('storeInfo');
const dateInfo = document.getElementById('dateInfo');
const totalInfo = document.getElementById('totalInfo');
const itemsTable = document.querySelector('#itemsTable tbody');

// Store patterns for detection
const STORE_PATTERNS = {
    'Basat1 Grocers': /Basat1 Grocers/i,
    'Braun\'s Ice Cream': /BRAUNS|Braun's/i,
    'Target': /Target/i,
    'Bosneft Brocers': /Bosneft: Brocers/i
};

// Event Listeners
receiptUpload.addEventListener('change', handleImageUpload);
processBtn.addEventListener('click', processReceipt);

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        preview.src = URL.createObjectURL(file);
        preview.style.display = 'block';
        processBtn.disabled = false;
    }
}

async function processReceipt() {
    const file = receiptUpload.files[0];
    if (!file) return;

    try {
        // Show processing indicator
        if (window.showResults) {
            document.getElementById('processing').style.display = 'block';
            document.getElementById('results').style.display = 'none';
        }

        // Perform OCR with English language and better segmentation
        const { data: { text } } = await Tesseract.recognize(file, 'eng', {
            tessedit_pageseg_mode: 6,
            preserve_interword_spaces: true
        });

        console.log("Raw OCR Text:", text); // For debugging

        // Display all raw text for manual testing
        displayRawText(text);

        // Parse receipt data
        const receiptData = parseReceipt(text);

        // Display results
        displayResults(receiptData);

    } catch (error) {
        console.error('Error processing receipt:', error);
        alert('Error processing receipt. Please try again.');
        if (window.showResults) {
            document.getElementById('processing').style.display = 'none';
        }
    }
}

// Add this function to show the raw OCR text above the results
function displayRawText(text) {
    let rawDiv = document.getElementById('rawText');
    if (!rawDiv) {
        rawDiv = document.createElement('div');
        rawDiv.id = 'rawText';
        rawDiv.style = 'white-space: pre-wrap; background: #f9f9f9; border: 1px solid #eee; margin: 10px 0; padding: 10px; font-size: 13px; color: #333;';
        document.querySelector('.container').insertBefore(rawDiv, document.getElementById('results'));
    }
    // Remove blank lines for display
    const filtered = text.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n');
    rawDiv.innerHTML = `<strong>Raw OCR Text:</strong><br>${filtered}`;
}

function parseReceipt(text) {
    // Normalize text for better matching
    text = text.replace(/\r/g, '\n').replace(/\n{2,}/g, '\n').trim();

    // Detect store (try first 5 lines as well for robustness)
    let store = 'Unknown Store';
    for (const [storeName, pattern] of Object.entries(STORE_PATTERNS)) {
        if (pattern.test(text)) {
            store = storeName;
            break;
        }
    }
    if (store === 'Unknown Store') {
        const firstLines = text.split('\n').slice(0, 5).join(' ');
        for (const [storeName, pattern] of Object.entries(STORE_PATTERNS)) {
            if (pattern.test(firstLines)) {
                store = storeName;
                break;
            }
        }
    }

    // Extract date (handles multiple formats)
    let date = 'Unknown Date';
    const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})|([A-Za-z]+ \d{1,2}, \d{4})|(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) date = dateMatch[0];

    // --- Improved item extraction ---
    let items = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Skip summary/total/tax/payment lines
        if (/(total|sub|tax|refund|credit|cash|change|amount|balance|payment|visa|mastercard|debit|card|tendered|due|vat|gst|round)/i.test(line)) continue;

        // Weighted item: "0.78LB Ginger $2.33" or "0.78 LB Ginger $2.33"
        let weighted = line.match(/^(\d+\.?\d*)\s*L?B?\s+([A-Za-z0-9\s\-\(\)\.\#]+?)\s+\$?(\d+\.\d{2})$/i);
        if (weighted) {
            items.push({
                name: weighted[2].trim(),
                quantity: parseFloat(weighted[1]),
                price: parseFloat(weighted[3]),
                total: parseFloat(weighted[3])
            });
            continue;
        }

        // Quantity, name, price: "2 Apple $1.50"
        let qtyNamePrice = line.match(/^(\d+)\s+([A-Za-z0-9\s\-\(\)\.\#]+?)\s+\$?(\d+\.\d{2})$/);
        if (qtyNamePrice) {
            items.push({
                name: qtyNamePrice[2].trim(),
                quantity: parseInt(qtyNamePrice[1]),
                price: parseFloat(qtyNamePrice[3]),
                total: parseFloat(qtyNamePrice[3]) * parseInt(qtyNamePrice[1])
            });
            continue;
        }

        // Name and price: "Soap $2.99" or "Soap 2.99"
        let namePrice = line.match(/^([A-Za-z0-9\s\-\(\)\.\#]+?)\s+\$?(\d+\.\d{2})$/);
        if (namePrice) {
            items.push({
                name: namePrice[1].trim(),
                quantity: 1,
                price: parseFloat(namePrice[2]),
                total: parseFloat(namePrice[2])
            });
            continue;
        }

        // Price at end: "Milk 2% 1L 3.49"
        let priceAtEnd = line.match(/^(.+?)\s+\$?(\d+\.\d{2})$/);
        if (priceAtEnd) {
            // Avoid duplicate with previous match
            if (!items.length || items[items.length - 1].name !== priceAtEnd[1].trim()) {
                items.push({
                    name: priceAtEnd[1].trim(),
                    quantity: 1,
                    price: parseFloat(priceAtEnd[2]),
                    total: parseFloat(priceAtEnd[2])
                });
            }
            continue;
        }

        // Price only: "$2.99" (attach to previous item if possible)
        let priceOnly = line.match(/^\$?(\d+\.\d{2})$/);
        if (priceOnly && items.length > 0) {
            let prev = items[items.length - 1];
            if (prev && (!prev.total || prev.total === 0)) {
                prev.total = parseFloat(priceOnly[1]);
                if (!prev.price || prev.price === 0) prev.price = prev.total / prev.quantity;
            }
        }
    }

    // If still empty, try to extract any line with a price and at least one word
    if (items.length === 0) {
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let fallback = line.match(/^(.+?)\s+\$?(\d+\.\d{2})$/);
            if (fallback && /\w/.test(fallback[1])) {
                items.push({
                    name: fallback[1].trim(),
                    quantity: 1,
                    price: parseFloat(fallback[2]),
                    total: parseFloat(fallback[2])
                });
            }
        }
    }

    // Remove items with empty name or zero price
    items = items.filter(item => item && item.name && item.name.length > 0 && item.price > 0);

    // Extract totals
    const totalMatch = text.match(/total.*?\$?(\d+\.\d{2})/i);
    const total = totalMatch ? parseFloat(totalMatch[1]) : 
                 items.reduce((sum, item) => sum + item.total, 0);

    return {
        store,
        date,
        items,
        total
    };
}

function displayResults(data) {
    storeInfo.innerHTML = `<strong>Store:</strong> ${data.store}`;
    dateInfo.innerHTML = `<strong>Date:</strong> ${data.date}`;
    totalInfo.innerHTML = `<strong>Total:</strong> $${data.total.toFixed(2)}`;

    // Clear previous items
    itemsTable.innerHTML = '';

    // Add new items
    if (data.items.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="4" style="text-align:center;color:#888;">No items detected</td>`;
        itemsTable.appendChild(row);
    } else {
        data.items.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>$${item.price.toFixed(2)}</td>
                <td>$${item.total.toFixed(2)}</td>
            `;
            itemsTable.appendChild(row);
        });
    }

    // Show results section and hide processing
    if (window.showResults) window.showResults();
}