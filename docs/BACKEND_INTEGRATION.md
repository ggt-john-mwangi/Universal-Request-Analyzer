# Backend Integration Guide

## Overview

The Universal Request Analyzer is designed to support backend integration for team collaboration, data synchronization, and centralized analytics. This guide covers the REST API integration architecture and implementation.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Extension                         │
│  ┌─────────────────┐                  ┌──────────────────┐  │
│  │  Local SQLite   │◄────────────────►│  Backend API     │  │
│  │  (Medallion)    │  Data Sync       │  Service         │  │
│  └─────────────────┘                  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ REST API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend Server                            │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Auth      │  │  Data Sync   │  │  Team Management │   │
│  │   Service   │  │  Service     │  │  Service         │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Centralized Database (PostgreSQL)         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Features

### 1. Authentication
- User registration and login
- JWT token-based authentication
- Automatic token refresh
- Session management

### 2. Data Synchronization
- Bi-directional sync between local and backend
- Conflict resolution with merge strategies
- Incremental sync based on timestamps
- Sync queue for offline support

### 3. Team Collaboration
- Team member management
- Data sharing between team members
- Role-based access control (future)
- Team analytics aggregation (future)

## Backend API Service

### Configuration

```javascript
const config = {
  baseUrl: 'https://api.yourdomain.com/v1',
  apiKey: 'your-api-key',  // Optional API key
  timeout: 30000           // Request timeout in ms
};

const backendApi = setupBackendApiService(config, eventBus);
await backendApi.initialize();
```

### Authentication

#### Login

```javascript
const result = await backendApi.login('user@example.com', 'password');

if (result.success) {
  console.log('Logged in:', result.user);
  // Token is automatically stored and used for subsequent requests
}
```

#### Logout

```javascript
await backendApi.logout();
```

#### Register

```javascript
const result = await backendApi.register({
  email: 'user@example.com',
  password: 'securepassword',
  name: 'John Doe',
  teamName: 'My Team'  // Optional: create new team
});
```

#### Token Verification

```javascript
const isValid = await backendApi.verifyToken();
```

### Data Synchronization

#### Upload Data

```javascript
// Sync requests to backend
const requests = [...]; // Array of request objects

const result = await backendApi.syncData('requests', requests, {
  teamId: 'team-123',
  merge: true,  // Merge with existing data
  lastSyncTimestamp: 1638316800000
});

if (result.success) {
  console.log('Sync ID:', result.syncId);
  console.log('Server timestamp:', result.timestamp);
}
```

#### Download Data

```javascript
// Download requests from backend
const result = await backendApi.downloadData('requests', {
  teamId: 'team-123',
  since: 1638316800000,  // Only get data since this timestamp
  limit: 1000
});

if (result.success) {
  const requests = result.data;
  const lastSync = result.lastSyncTimestamp;
  
  // Merge into local database
  await mergeRequestsIntoDatabase(requests);
}
```

### Team Management

#### Get Team Members

```javascript
const result = await backendApi.getTeamMembers();

if (result.success) {
  result.members.forEach(member => {
    console.log(member.name, member.role, member.email);
  });
}
```

#### Share Data with Team

```javascript
const result = await backendApi.shareWithTeam('requests', 'request-id-123', [
  'read', 'write'
]);
```

## Data Sync Manager

The Data Sync Manager handles automatic synchronization between local SQLite and backend.

### Configuration

```javascript
const config = {
  autoSync: true,           // Enable automatic sync
  syncIntervalMs: 300000,   // Sync every 5 minutes
  conflictResolution: 'merge'  // How to handle conflicts
};

const dataSyncManager = setupDataSyncManager(
  dbManager,
  backendApi,
  eventBus,
  config
);

await dataSyncManager.initialize();
```

### Manual Sync

```javascript
// Force sync now
const result = await dataSyncManager.forceSyncNow();

if (result.success) {
  console.log('Uploaded:', result.results.uploaded);
  console.log('Downloaded:', result.results.downloaded);
  console.log('Errors:', result.results.errors);
}
```

### Sync Status

```javascript
const status = dataSyncManager.getStatus();

console.log('Is syncing:', status.isSyncing);
console.log('Last sync:', new Date(status.lastSyncTimestamp));
console.log('Auto-sync enabled:', status.autoSyncEnabled);
console.log('Queued items:', status.queuedItems);
```

### Event Listeners

```javascript
// Listen for sync events
eventBus.subscribe('sync:started', (data) => {
  console.log('Sync started at:', data.timestamp);
});

eventBus.subscribe('sync:completed', (data) => {
  console.log('Sync completed:', data.results);
});

eventBus.subscribe('sync:failed', (data) => {
  console.error('Sync failed:', data.error);
});
```

## Backend API Endpoints

### Authentication Endpoints

```
POST   /auth/register         Register new user
POST   /auth/login            User login
POST   /auth/logout           User logout
POST   /auth/refresh          Refresh access token
GET    /auth/verify           Verify token validity
```

### Sync Endpoints

```
POST   /sync/upload           Upload data to backend
GET    /sync/download         Download data from backend
GET    /sync/status           Get sync status
DELETE /sync/clear            Clear synced data
```

### Team Endpoints

```
GET    /teams/:teamId/members        Get team members
POST   /teams/:teamId/invite         Invite team member
POST   /teams/:teamId/share          Share data with team
DELETE /teams/:teamId/members/:id    Remove team member
```

### Health Endpoint

```
GET    /health                Check API health
```

## Request/Response Format

### Standard Response Format

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation completed successfully",
  "timestamp": 1638316800000
}
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "details": {}
  },
  "timestamp": 1638316800000
}
```

## Data Sync Flow

### Upload Flow

```
1. User performs action → Data saved to Bronze layer
2. MedallionManager processes to Silver layer
3. DataSyncManager queues for sync
4. Auto-sync interval triggers OR manual sync
5. DataSyncManager fetches data from Silver layer
6. BackendApiService uploads to backend
7. Backend stores in centralized database
8. Backend returns sync ID and timestamp
9. Local lastSyncTimestamp updated
```

### Download Flow

```
1. Auto-sync interval triggers OR manual sync
2. DataSyncManager requests data since lastSyncTimestamp
3. BackendApiService calls /sync/download
4. Backend returns data modified since timestamp
5. DataSyncManager merges into local database
6. Conflict resolution applied if needed
7. Local lastSyncTimestamp updated
```

## Conflict Resolution

When same data exists both locally and on backend:

### Strategy 1: Server Wins (Default)
```javascript
// Backend data overwrites local data
config.conflictResolution = 'server-wins';
```

### Strategy 2: Client Wins
```javascript
// Local data overwrites backend data
config.conflictResolution = 'client-wins';
```

### Strategy 3: Merge
```javascript
// Merge based on timestamps (newer wins per field)
config.conflictResolution = 'merge';
```

### Strategy 4: Manual
```javascript
// Prompt user to resolve conflicts
config.conflictResolution = 'manual';

eventBus.subscribe('sync:conflict', (data) => {
  // Show UI for user to choose
  showConflictResolutionUI(data.local, data.remote);
});
```

## Security Considerations

### 1. Token Storage
- Tokens stored in chrome.storage.local (encrypted by browser)
- Automatic token refresh before expiration
- Tokens cleared on logout

### 2. HTTPS Required
- All API calls must use HTTPS
- Certificate pinning recommended for production

### 3. Data Encryption
- Sensitive data encrypted before upload (future enhancement)
- End-to-end encryption for team sharing (future enhancement)

### 4. Rate Limiting
- Client-side rate limiting to prevent abuse
- Exponential backoff on errors

## Implementation Checklist

### Backend Server (To Be Implemented)

- [ ] User authentication system
- [ ] JWT token generation and validation
- [ ] PostgreSQL database setup
- [ ] REST API endpoints
- [ ] Team management
- [ ] Data sync logic
- [ ] Conflict resolution
- [ ] Rate limiting
- [ ] Logging and monitoring

### Extension (Implemented)

- [x] BackendApiService class
- [x] DataSyncManager class
- [x] Authentication flow
- [x] Token management
- [x] Auto-sync mechanism
- [x] Event bus integration
- [x] Error handling
- [ ] UI for backend configuration
- [ ] UI for team management
- [ ] Conflict resolution UI

## Usage Example

Complete example of backend integration:

```javascript
// 1. Initialize services
const backendApi = setupBackendApiService(config, eventBus);
await backendApi.initialize();

const dataSyncManager = setupDataSyncManager(
  dbManager,
  backendApi,
  eventBus,
  syncConfig
);
await dataSyncManager.initialize();

// 2. User logs in
const loginResult = await backendApi.login('user@example.com', 'password');

if (loginResult.success) {
  // 3. Start auto-sync
  dataSyncManager.startAutoSync(300000); // Every 5 minutes
  
  // 4. Sync is now automatic
  // Data flows: Local → Backend and Backend → Local
}

// 5. Manual sync when needed
await dataSyncManager.forceSyncNow();

// 6. Share with team
await backendApi.shareWithTeam('requests', 'req-123', ['read']);

// 7. Logout
await backendApi.logout();
```

## Future Enhancements

1. **Real-time Sync**: WebSocket-based real-time updates
2. **Offline Queue**: Queue changes when offline, sync when online
3. **Selective Sync**: Choose which data types to sync
4. **Compression**: Compress data before upload
5. **Delta Sync**: Only sync changed fields
6. **P2P Sync**: Direct sync between team members
7. **Backup/Restore**: Cloud backup and restore
8. **Multi-device**: Sync across multiple browsers/devices
