# Semester Module Testing Guide

## ไฟล์เทสต์ที่สร้างขึ้น

### 1. Unit Tests
- **semester.service.spec.ts** - เทสต์ business logic ใน service
- **semester.controller.spec.ts** - เทสต์ REST API endpoints
- **semester.dto.spec.ts** - เทสต์ data validation

### 2. Integration Tests  
- **semester.e2e-spec.ts** - เทสต์ end-to-end API

## วิธีการรันเทสต์

### รันเทสต์ทั้งหมด
```bash
npm test
```

### รันเทสต์เฉพาะ semester module
```bash
# รันเทสต์ทั้งหมดของ semester module
npm test -- --testPathPattern=semester

# หรือรันเทสต์เฉพาะไฟล์
npm test semester.service.spec.ts
npm test semester.controller.spec.ts
npm test semester.dto.spec.ts
```

### รันเทสต์แบบ watch mode (รันใหม่อัตโนมัติเมื่อไฟล์เปลี่ยน)
```bash
npm run test:watch
```

### รันเทสต์พร้อม coverage report
```bash
npm run test:cov
```

### รัน e2e tests
```bash
npm run test:e2e
```

### รันเทสต์แบบ debug
```bash
npm run test:debug
```

## การใช้งาน Test Scripts เฉพาะ

### รันเทสต์เฉพาะ test suite
```bash
# รันเฉพาะ SemesterService tests
npm test -- --testNamePattern="SemesterService"

# รันเฉพาะ SemesterController tests  
npm test -- --testNamePattern="SemesterController"
```

### รันเทสต์เฉพาะ method
```bash
# รันเฉพาะเทสต์ของ findById method
npm test -- --testNamePattern="findById"

# รันเฉพาะเทสต์ของ create method
npm test -- --testNamePattern="create"
```

## Structure ของ Test Files

### 1. semester.service.spec.ts
เทสต์ทุก method ใน SemesterService:
- `findById()` - หา semester by ID
- `search()` - ค้นหา semester ด้วย filters
- `getActiveSemesters()` - ดึง active semesters
- `create()` - สร้าง semester ใหม่
- `update()` - อัปเดต semester
- `delete()` - ลบ semester
- `createSemesterSubject()` - สร้าง semester-subject relation
- `deleteSemesterSubject()` - ลบ semester-subject relation

### 2. semester.controller.spec.ts
เทสต์ทุก endpoint:
- `GET /semester/active/list` - รายการ active semesters
- `GET /semester` - ค้นหา semesters
- `GET /semester/:id` - หา semester by ID
- `POST /semester` - สร้าง semester
- `PUT /semester/:id` - อัปเดต semester
- `DELETE /semester/:id` - ลบ semester
- `POST /semester/subject` - สร้าง semester-subject
- `DELETE /semester/subject` - ลบ semester-subject

### 3. semester.dto.spec.ts
เทสต์ validation ของ DTOs:
- `SearchSemesterDto` - validation parameters สำหรับค้นหา
- `CreateSemesterDto` - validation สำหรับสร้าง semester
- `UpdateSemesterDto` - validation สำหรับอัปเดต
- `CreateSemesterSubjectDto` - validation สำหรับสร้าง relation
- `DeleteSemesterSubjectDto` - validation สำหรับลบ relation

### 4. semester.e2e-spec.ts
เทสต์ integration ทั้งระบบ:
- HTTP requests/responses
- Error handling
- Parameter validation
- Business logic integration

## Test Coverage

เทสต์ครอบคลุม:
- ✅ Happy path scenarios
- ✅ Error scenarios (404, 400, 409, 500)
- ✅ Input validation
- ✅ Database errors
- ✅ Edge cases
- ✅ Parameter parsing
- ✅ DTO transformations

## การ Debug Tests

### หาก test fail สามารถดู details ได้จาก:
```bash
npm test -- --verbose
```

### รัน test แค่ไฟล์เดียวเพื่อ debug:
```bash
npm test semester.service.spec.ts -- --verbose
```

### ดู test coverage แบบ detailed:
```bash
npm run test:cov
# จะสร้างโฟลเดอร์ coverage/ พร้อม HTML report
```

## Tips สำหรับการเขียน Test เพิ่มเติม

1. **Mock external dependencies** เสมอ (database, HTTP calls)
2. **Test both success และ error cases**
3. **Use descriptive test names** ที่อธิบายว่าทำอะไร
4. **Arrange, Act, Assert** pattern
5. **Clean up mocks** ระหว่างเทสต์ด้วย `jest.clearAllMocks()`

## ตัวอย่าง Output ที่คาดหวัง

เมื่อรันเทสต์สำเร็จจะเห็น:
```
 PASS  src/modules/semester/semester.service.spec.ts
 PASS  src/modules/semester/semester.controller.spec.ts  
 PASS  src/modules/semester/dto/semester.dto.spec.ts
 PASS  src/modules/semester/semester.e2e-spec.ts

Test Suites: 4 passed, 4 total
Tests:       XX passed, XX total
Snapshots:   0 total
Time:        X.XXs
```