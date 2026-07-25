# Holiday Count Fix - TODO

## Backend Changes

- [x] **1. Remove `holidayCount` from `buildSummary` aggregation**
  - File: `crm-backend/src/controllers/attendanceController.js`
  - Remove the `holidayCount: { $sum: ... }` line from the MongoDB aggregation pipeline

- [x] **2. Count unique holidays from policy in `getAttendanceRecords`**
  - File: `crm-backend/src/controllers/attendanceController.js`
  - Import `getAttendancePolicy` at the top (already imported)
  - After computing rangeStart/rangeEnd, fetch the policy
  - Count holidays within the date range
  - Override `summary.holidayCount` with the unique count

- [x] **3. Restart backend server**
  - Restart the backend to apply changes

