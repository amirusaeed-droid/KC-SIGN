E-Stock
Advanced Inventory & Stock Management System
Secretariat of the Kondey Council

Default Login
Email: admin@kondeycouncil.gov.mv
Password: admin123

Database Name
Recommended database name: e_stock

Main Features
- Secure login
- Role based users: Admin, SG, Store Keeper, Staff, Viewer
- Dashboard
- Item master
- Categories
- Suppliers
- Stock In
- Stock Out
- Stock Requests
- Approval workflow
- Monthly reports
- Stock balance checking
- Low stock alerts
- CSV export
- Print / Save as PDF
- Audit logs

Local Server Setup with XAMPP
1. Install XAMPP.
2. Start Apache and MySQL.
3. Copy the E-Stock folder to:
   C:\xampp\htdocs\
4. Open phpMyAdmin:
   http://localhost/phpmyadmin
5. Create a database named:
   e_stock
6. Import this SQL file:
   E-Stock/sql/database.sql
7. Check database connection in:
   E-Stock/config/db.php
8. Open:
   http://localhost/E-Stock/login.php

GitHub Note
This PHP + MySQL version cannot run directly on GitHub Pages because GitHub Pages supports static websites only.
For GitHub Pages, we need the Supabase version of E-Stock.

Important Security Step
After first login, change the default admin password.
