# Catering Order Manager - Local PC Setup & User Guide

This guide will walk you through setting up and running the Catering Order Manager on your local computer, as well as how to prepare your CSV file and use the application's features.

---

## 💻 1. Local PC Setup Guide

To run this application locally, you'll need to have **Node.js** installed on your computer.

### Step 1: Install Node.js
1. Go to the official Node.js website: [nodejs.org](https://nodejs.org/)
2. Download and install the **LTS (Long Term Support)** version recommended for most users.
3. Once installed, open your Terminal (macOS/Linux) or Command Prompt (Windows) and verify the installation by running:
   ```bash
   node -v
   npm -v
   ```
   Both commands should return a version number.

### Step 2: Download the Project
Extract the project ZIP file or clone the repository to a folder on your local PC.
For example, create a folder named `catering-manager` and place the project files inside.

### Step 3: Install Dependencies
1. Open your terminal or command prompt.
2. Navigate to your project directory:
   ```bash
   cd path/to/your/catering-manager
   ```
3. Install the required project packages by running:
   ```bash
   npm install
   ```

### Step 4: Run the Application Locally
1. In your terminal, run the following command to start the local development server:
   ```bash
   npm run dev
   ```
2. The terminal will display a local URL (usually `http://localhost:5173`).
3. Copy and paste this URL into your web browser (Chrome, Edge, Safari, or Firefox) to open the Catering Order Manager.

### Step 5: Build for Production (Optional)
If you want to build a single standalone HTML page that can be opened on any PC without running a server:
1. Run:
   ```bash
   npm run build
   ```
2. Go to the newly created `dist/` folder.
3. You will find a single `index.html` file. You can double-click this file to open the app directly in any browser offline!

---

## 📊 2. Preparing your CSV Files

The application supports two types of CSV files:

### File A: Orders CSV File (Required)
Your Orders CSV file must have a header row with these exact column names (case-insensitive):
* `First Name`
* `Last Name`
* `Order Date`
* `Menu Item`
* `Quantity`
* `Product Vendor`
* `Order Note`

#### Example Orders CSV Content:
```csv
"First Name","Last Name","Order Date","Menu Item",Quantity,"Product Vendor","Order Note"
"John","Smith","2024-03-15","Chicken Biryani",2,"Tasty Foods","Extra spicy"
"Jane","Doe","2024-03-15","Veggie Wrap",1,"Green Kitchen","No onions, please"
"Alice","Johnson","2024-03-15","Chicken Biryani",1,"Tasty Foods",""
"Bob","Brown","2024-03-16","Chocolate Muffin",4,"Sweet Delights","Deliver by 9 AM"
```

### File B: Menu Prices CSV File (Optional)
Uploading a Menu Prices CSV unlocks cost subtotals for each grouped menu item and a grand total for the whole batch. 
It must contain these exact column names:
* `Food Items`
* `Vendors`
* `Price`
* `Descriptions`

#### Example Menu Prices CSV Content:
```csv
"Food Items","Vendors","Price","Descriptions"
"Chicken Biryani","Tasty Foods",12.50,"Fragrant long-grain basmati rice cooked with chicken"
"Veggie Wrap","Green Kitchen",8.00,"Whole wheat tortilla with mixed greens and avocado"
"Chocolate Muffin","Sweet Delights",3.50,"Double chocolate muffin topped with dark chips"
```

*Note: If your fields contain commas, make sure they are enclosed in double quotes (e.g., `"No onions, please"`).*

---

## 🚀 3. How to Use the Application

Once you have opened the app and prepared your CSV file, follow these steps to manage your catering orders:

### 📥 Step 1: Uploading the CSV
1. Click on the dotted drop-zone box on the home page, or simply drag and drop your `.csv` file directly into it.
2. The system will parse the file instantly and load your dashboard.

### 📈 Step 2: Reading the Dashboard Stats
Once loaded, four summary cards will display overall statistics:
* **Total Orders**: Total number of individual orders/people.
* **Unique Menu Items**: How many distinct dishes have been ordered.
* **Total Items to Prepare**: The sum of all quantities from all orders combined.
* **Vendors**: Number of different product suppliers.

### 🍽️ Step 3: Viewing Grouped Menu Items
* Orders are automatically grouped by the **Menu Item** name.
* Each menu item gets its own card showing the **Item Name**, **Total Quantity** to prepare, and **Total Orders**.
* If any order within that group has a special note, an amber ⚠️ **Has special notes** badge is displayed on the card header.
* **Expand/Collapse**: Click anywhere on a menu item card header to expand or collapse the list of people who ordered it.

### 👤 Step 4: Tracking Deliveries and Special Notes
* Under each expanded menu item, a detailed table lists:
  * **Deliver To**: The First and Last Name of the person.
  * **Qty**: The individual quantity they ordered.
  * **Vendor**: The Product Vendor.
  * **Order Date**: Scheduled date.
  * **Special Notes**: Highlighted in an amber alert box with a warning icon to ensure the kitchen staff doesn't miss instructions like *"No onions"* or *"Extra spicy"*.

### 🔍 Step 5: Searching and Filtering
Use the search bar at the top to instantly filter the entire dataset by:
* Person's name (First or Last)
* Menu item name
* Vendor name
* Special notes content (e.g., searching "spicy" will filter only groups/orders with "spicy" in the note)

### 🔀 Step 6: Sorting Groups
Use the sort dropdown next to the search bar to organize the menu item list:
* **Qty (High → Low)**: Puts the most ordered items at the top (perfect for batch cooking).
* **Qty (Low → High)**: Puts the least ordered items at the top.
* **Name (A → Z)** or **Name (Z → A)**: Alphabetical sorting.
* **Orders (Most → Least)** or **Orders (Least → Most)**: Sort by the number of individual customers per item.

### 🖨️ Step 7: Printing the Kitchen Report
* Click the **Print Kitchen Report** or **Print** button to trigger your system's print dialog.
* The page has custom **print-optimized CSS** that hides search bars, upload options, and control buttons.
* It formats the tables to fit perfectly on physical paper or as a PDF, so you can easily hand a physical copy to your chefs in the kitchen.
