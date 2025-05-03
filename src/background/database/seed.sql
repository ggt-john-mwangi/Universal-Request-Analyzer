-- Seed data for the Universal Request Analyzer database

-- Clear existing data (optional, use with caution)
-- DELETE FROM request_headers;
-- DELETE FROM request_timings;
-- DELETE FROM requests;
-- DELETE FROM errors;

-- Sample Request 1
INSERT INTO requests (id, url, method, type, status, statusText, domain, path, startTime, endTime, duration, size, timestamp, tabId, pageUrl, error, userId, projectId, environmentId, tags)
VALUES
('req_1', 'https://api.example.com/users', 'GET', 'fetch', 200, 'OK', 'api.example.com', '/users', 1678886400000, 1678886400150, 150, 1024, 1678886400000, 1, 'https://app.example.com/dashboard', NULL, 'user_abc', 'proj_123', 'env_prod', '["api", "users"]');

-- Sample Timings for Request 1
INSERT INTO request_timings (requestId, dns, tcp, ssl, ttfb, download)
VALUES
('req_1', 10, 20, 30, 50, 40);

-- Sample Headers for Request 1
INSERT INTO request_headers (requestId, name, value)
VALUES
('req_1', 'Content-Type', 'application/json'),
('req_1', 'Authorization', 'Bearer xyz');

-- Sample Request 2 (Error)
INSERT INTO requests (id, url, method, type, status, statusText, domain, path, startTime, endTime, duration, size, timestamp, tabId, pageUrl, error, userId, projectId, environmentId, tags)
VALUES
('req_2', 'https://api.example.com/data', 'POST', 'xhr', 500, 'Internal Server Error', 'api.example.com', '/data', 1678886405000, 1678886405300, 300, 50, 1678886405000, 1, 'https://app.example.com/dashboard', 'Server failed to process request', 'user_abc', 'proj_123', 'env_prod', '["api", "errors"]');

-- Sample Timings for Request 2
INSERT INTO request_timings (requestId, dns, tcp, ssl, ttfb, download)
VALUES
('req_2', 15, 25, 0, 200, 60);

-- Sample Headers for Request 2
INSERT INTO request_headers (requestId, name, value)
VALUES
('req_2', 'Content-Type', 'application/json'),
('req_2', 'X-Request-ID', 'abc-123');

-- Sample Tag
INSERT INTO tags (name, color, createdAt)
VALUES
('api', '#3498db', 1678886400000),
('errors', '#e74c3c', 1678886400000),
('users', '#2ecc71', 1678886400000);

-- Link tags to requests
INSERT INTO request_tags (requestId, tagId)
VALUES
('req_1', (SELECT id from tags WHERE name = 'api')),
('req_1', (SELECT id from tags WHERE name = 'users')),
('req_2', (SELECT id from tags WHERE name = 'api')),
('req_2', (SELECT id from tags WHERE name = 'errors'));

-- Sample Logged Error
INSERT INTO errors (category, message, stack, timestamp, context)
VALUES
('DatabaseError', 'Failed to save request', 'Error: Failed to save request\n    at saveRequest (db-manager.js:350:1)', 1678886410000, '{"requestId": "req_failed"}');

