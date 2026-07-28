# 📈 BizSync

**BizSync** is a cross-platform business management platform designed for small businesses and collaborative teams. It combines invoicing, inventory management, customer tracking, and revenue analytics into a single application while securely isolating each organization's data through a **multi-tenant architecture**.

Built with **React Native**, **Expo**, **Firebase**, and **Electron**, BizSync runs on **Android**, **Windows**, **macOS**, and the **Web** from a single shared codebase, allowing teams to stay synchronized regardless of the device they use.

---

# ✨ Features

## 🏢 Organization Management

BizSync is built around **organizations**, not individual accounts.

Users can:

* Create a new organization and become its administrator
* Join an existing organization using a unique organization code
* Invite teammates by sharing the organization code
* View organization members
* Securely isolate every organization's data

Every invoice, customer, product, and revenue record belongs exclusively to one organization.

---

## 📄 Invoice Management

Create and manage professional business invoices with an intuitive workflow.

Features include:

* Sales invoices
* Purchase invoices
* Dynamic line items
* Quantity and unit price editing
* Automatic total calculations
* Invoice-level discounts
* Partial payment support
* Paid & unpaid status tracking
* Professional PDF invoice generation
* Native sharing (WhatsApp, Email, etc.)

Invoices are generated using **expo-print**, producing business-ready PDF documents that can be instantly shared.

---

## 📦 Inventory Management

Track inventory in real time.

Features:

* Product catalog
* Stock quantity management
* Low-stock indicators
* Product pricing
* PKR currency formatting
* Decimal price support

Inventory updates automatically as invoices are processed.

---

## 👥 Customer Management

Keep all customer information organized in one place.

Each customer includes:

* Customer details
* Complete invoice history
* Expandable transaction timeline
* Outstanding invoices
* Purchase history

This allows businesses to quickly review customer activity without searching through invoices.

---

## 📊 Dashboard & Analytics

BizSync provides an at-a-glance overview of business performance.

Dashboard widgets include:

* Today's Revenue
* Monthly Revenue
* Pending Invoices
* Product Count
* Customer Count
* Revenue Trend Chart
* Recent Transactions Feed

Revenue visualization is powered by **react-native-gifted-charts**.

---

## ⚙️ Settings

Manage both your account and organization.

Features include:

* Organization Code
* Copy-to-Clipboard Organization Code
* Team Member List
* Profile Editing
* Password Change
* Account Deletion

---

## 💻 Responsive Desktop Experience

BizSync isn't simply a mobile application stretched onto a desktop screen.

The desktop version automatically adapts with:

* Persistent sidebar navigation
* Centered content layout
* Maximum content width
* Improved spacing for large displays
* Better productivity workflow

The same Firebase backend powers Android, Desktop, and Web.

---

# 🔒 Security & Multi-Tenancy

BizSync uses Firebase Authentication together with Firestore Security Rules to provide secure organization isolation.

Every authenticated user belongs to exactly one organization.

The included security rules ensure users can:

* Read only their organization's data
* Create data inside their organization
* Update only authorized documents
* Never access another organization's records

No Cloud Functions are required.

---

# 🏗️ Architecture

BizSync follows a multi-tenant architecture.

```text
                Organization
                     │
      ┌──────────────┼──────────────┐
      │              │              │
   Users         Customers      Products
      │              │              │
      └──────────────┼──────────────┘
                     │
                 Invoices
                     │
                  Sales Data
                     │
              Dashboard Analytics
```

Every collection is scoped by an organization ID, allowing multiple companies to use the application securely while sharing the same backend.

---

# 🔥 Firestore Collections

```text
organizations/
users/
products/
customers/
invoices/
sales/
orgCodes/
```

### organizations

Stores organization information.

### users

Stores user profiles and organization membership.

### products

Inventory and pricing.

### customers

Customer records.

### invoices

Sales and purchase invoices.

### sales

Revenue calculations for dashboard analytics.

### orgCodes

Maps organization codes to organization IDs for secure "Join Organization" functionality without exposing the organizations collection.

---

# 🛠️ Technologies Used

## Frontend

* React Native
* Expo
* Expo Router
* TypeScript
* NativeWind (Tailwind CSS)

## Backend

* Firebase Authentication
* Cloud Firestore

## Charts

* react-native-gifted-charts

## PDF Generation

* expo-print
* expo-sharing

## Desktop

* Electron

## Deployment

* EAS Build

---

# 📁 Project Structure

```text
BizSync/
│
├── app/
│   │
│   ├── (auth)/
│   │   ├── Sign In
│   │   ├── Sign Up
│   │   └── Organization Setup
│   │
│   ├── (tabs)/
│   │   ├── Dashboard
│   │   ├── Invoices
│   │   ├── Products
│   │   ├── Customers
│   │   ├── Analytics
│   │   └── Settings
│   │
│   ├── _layout.tsx
│   └── index.tsx
│
├── Components/
│   ├── Dashboard Cards
│   ├── Revenue Chart
│   ├── Recent Transactions
│   └── Shared UI Components
│
├── config/
│   └── firebaseConfig.ts
│
├── lib/
│   ├── generateInvoicePdf.ts
│   ├── validation.ts
│   └── utils.ts
│
├── desktop/
│   └── Electron Wrapper
│
├── firestore.rules
│
└── README.md
```

---

# 🚀 Installation

## Clone the Repository

```bash
git clone <repository-url>
cd BizSync
npm install
```

---

## Configure Firebase

Create a Firebase project.

Enable:

* Authentication → Email/Password
* Firestore Database

Register a **Web Application** and copy its configuration into:

```text
config/firebaseConfig.ts
```

---

## Deploy Firestore Rules

Publish the included `firestore.rules` file inside your Firebase project.

These rules enforce organization-level isolation entirely through Firestore Security Rules.

---

## Start the Development Server

```bash
npx expo start
```

Then:

* Press **a** for Android
* Press **w** for Web
* Scan the QR code using Expo Go

---

# 🏗️ Building

## Android APK

```bash
eas build --profile preview --platform android
```

For production releases:

```bash
eas build --profile production --platform android
```

---

## Desktop (Windows/macOS)

Export the web build:

```bash
npx expo export -p web
```

Copy the export:

```bash
cd desktop
rm -rf web-build
cp -r ../dist ./web-build
```

Run Electron:

```bash
npm start
```

Build installers:

```bash
npm run build
```

Installers will be generated inside:

```text
desktop/release/
```

---

# 📈 Business Logic

A few implementation details simplify BizSync's architecture:

* Organization codes are unique six-character alphanumeric identifiers generated client-side with automatic collision retries.
* Revenue calculations are driven entirely from the `sales` collection.
* Paid purchase invoices automatically create **negative revenue entries**, allowing dashboard statistics and revenue graphs to update without additional processing.
* Currency is formatted using Pakistani Rupees (`Rs. 1,23,456.00`) with full decimal precision.
* All devices remain synchronized in real time through Firestore.

---

# 🎯 Future Enhancements

* Barcode Scanner
* Expense Management
* Purchase Orders
* Supplier Management
* Offline Synchronization
* Push Notifications
* Role-Based Permissions (Admin, Manager, Employee)
* Multi-Currency Support
* Tax & GST Support
* CSV / Excel Export
* Cloud Backup
* AI Business Insights

---

# 📸 Screenshots

<img width="320" height="600" alt="WhatsApp Image 2026-07-26 at 10 19 44 PM (1)" src="https://github.com/user-attachments/assets/737838b8-8056-408b-87ff-7c223681c200" /> <img width="320" height="600" alt="WhatsApp Image 2026-07-26 at 10 19 44 PM" src="https://github.com/user-attachments/assets/182d6413-4358-4f5e-8cff-fd885d9afa2f" />  
<img width="320" height="600" alt="WhatsApp Image 2026-07-26 at 10 19 43 PM (2)" src="https://github.com/user-attachments/assets/aa954fd4-7961-426a-adda-079512e41e41" /> <img width="320" height="600" alt="WhatsApp Image 2026-07-26 at 10 19 43 PM" src="https://github.com/user-attachments/assets/d97f3c47-35b6-4f92-b1e3-17968310290c" />  
<img width="320" height="600" alt="WhatsApp Image 2026-07-26 at 10 19 43 PM (1)" src="https://github.com/user-attachments/assets/ba60c51e-2ba3-4b44-b474-32cc0d7caf68" /> <img width="320" height="600" alt="WhatsApp Image 2026-07-26 at 10 19 42 PM (1)" src="https://github.com/user-attachments/assets/7309c0ee-b795-45f8-a340-c0489be82fc1" />  
<img width="320" height="600" alt="WhatsApp Image 2026-07-26 at 10 30 49 PM" src="https://github.com/user-attachments/assets/76dae01b-c28e-45b7-bf19-99c9da651ced" />

---

# 🤝 Contributing

Contributions are welcome!

If you'd like to improve BizSync:

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Ensure the application builds successfully.
5. Open a Pull Request.

---

# 📄 License

This project is licensed under the **MIT License**.

See the `LICENSE` file for more information.

---

# 👨‍💻 Author

**Humair Ali**

Software Engineering Student

Interested in:

* Cross-Platform Development
* Mobile Applications
* Business Software
* Cybersecurity
* UI/UX Design
* Full-Stack Development

---

# 📈 BizSync

**Collaborative • Multi-Tenant • Cross-Platform • Built for Growing Businesses**

⭐ If you found this project useful, consider giving it a star!
