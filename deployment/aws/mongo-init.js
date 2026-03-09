// ============================================
// MongoDB Initialization Script
// ============================================
// Creates database, user, and indexes on first run

// Switch to application database
db = db.getSiblingDB(process.env.MONGO_INITDB_DATABASE || 'bijnisbooks');

// Create application user
db.createUser({
    user: 'bijnisbooks_app',
    pwd: process.env.MONGO_APP_PASSWORD || 'app_password_change_me',
    roles: [
        {
            role: 'readWrite',
            db: process.env.MONGO_INITDB_DATABASE || 'bijnisbooks'
        }
    ]
});

// Create indexes for better performance
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "tenant_id": 1 });
db.items.createIndex({ "tenant_id": 1, "name": 1 });
db.items.createIndex({ "sku": 1 });
db.variants.createIndex({ "item_id": 1 });
db.variants.createIndex({ "tenant_id": 1 });
db.central_stock.createIndex({ "tenant_id": 1, "variant_id": 1, "warehouse_id": 1 }, { unique: true });
db.sales.createIndex({ "tenant_id": 1, "created_at": -1 });
db.inventory.createIndex({ "tenant_id": 1, "variant_id": 1 });

print('MongoDB initialization completed successfully');
