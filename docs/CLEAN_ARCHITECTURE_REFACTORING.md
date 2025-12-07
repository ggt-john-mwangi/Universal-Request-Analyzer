# Clean Architecture Refactoring Plan

## Current Architecture Issues

### ❌ Violations Found

1. **No Layer Separation**
   - Domain, Application, and Infrastructure layers are mixed
   - Business logic scattered across database managers
   - No clear boundaries between layers

2. **Code Duplication**
   - `popup/components/tab-manager.js` (identical to options version)
   - `popup/components/settings-manager.js` (identical to options version)
   - `background.js` AND `background-medallion.js` (two entry points)
   - Total: 4 duplicate files

3. **SOLID Violations**
   - **SRP**: Single Responsibility Principle - classes doing multiple things
   - **OCP**: Open/Closed Principle - no interfaces, hard to extend
   - **LSP**: Liskov Substitution - no polymorphism
   - **ISP**: Interface Segregation - no interface segregation
   - **DIP**: Dependency Inversion - depending on concrete implementations

4. **Missing Patterns**
   - No Repository Pattern (direct SQL everywhere)
   - No Dependency Injection
   - No Use Case pattern
   - No Value Objects
   - No Domain Events

5. **Inconsistent Naming**
   - Some files: "Manager" (stateful services)
   - Some files: "Service" (stateless operations)
   - Some files: "Handler" (event processors)
   - No clear convention

---

## Target Clean Architecture

```
src/
├── domain/                          # Enterprise Business Rules
│   ├── entities/                    # Core business objects
│   │   ├── Request.js              # Request entity
│   │   ├── Domain.js               # Domain entity
│   │   ├── User.js                 # User entity
│   │   └── Session.js              # Session entity
│   │
│   ├── value-objects/              # Immutable value objects
│   │   ├── TimeRange.js           # Time period value object
│   │   ├── OHLCData.js            # OHLC candlestick data
│   │   ├── QualityMetrics.js      # Quality score metrics
│   │   └── PerformanceMetrics.js  # Performance metrics
│   │
│   ├── repositories/               # Repository interfaces (contracts)
│   │   ├── IRequestRepository.js  # Request data contract
│   │   ├── IDomainRepository.js   # Domain data contract
│   │   ├── IUserRepository.js     # User data contract
│   │   └── IAnalyticsRepository.js # Analytics data contract
│   │
│   ├── services/                   # Domain services (pure business logic)
│   │   ├── RequestAnalyzer.js     # Analyze request patterns
│   │   ├── QualityCalculator.js   # Calculate quality scores
│   │   ├── PerformanceAnalyzer.js # Analyze performance metrics
│   │   └── DomainTracker.js       # Track domain changes (SCD Type 2)
│   │
│   └── events/                     # Domain events
│       ├── RequestCaptured.js
│       ├── DomainUpdated.js
│       └── QualityThresholdExceeded.js
│
├── application/                     # Application Business Rules
│   ├── use-cases/                  # Application use cases
│   │   ├── CaptureRequest.js      # Capture browser request
│   │   ├── GenerateOHLC.js        # Generate OHLC analytics
│   │   ├── AuthenticateUser.js    # Authenticate user
│   │   ├── ExportData.js          # Export request data
│   │   └── SyncWithBackend.js     # Sync with backend server
│   │
│   ├── services/                   # Application services (orchestration)
│   │   ├── MedallionOrchestrator.js # Orchestrate Bronze→Silver→Gold
│   │   ├── SyncOrchestrator.js    # Orchestrate data synchronization
│   │   └── AnalyticsOrchestrator.js # Orchestrate analytics generation
│   │
│   ├── dto/                        # Data Transfer Objects
│   │   ├── RequestDTO.js
│   │   ├── OHLCDTO.js
│   │   └── UserDTO.js
│   │
│   └── ports/                      # Ports for external adapters
│       ├── IStoragePort.js
│       ├── IMessagingPort.js
│       └── IApiPort.js
│
├── infrastructure/                  # Frameworks & Drivers
│   ├── database/                   # Database implementation
│   │   ├── repositories/          # Concrete repository implementations
│   │   │   ├── SqliteRequestRepository.js
│   │   │   ├── SqliteDomainRepository.js
│   │   │   ├── SqliteUserRepository.js
│   │   │   └── SqliteAnalyticsRepository.js
│   │   │
│   │   ├── migrations/            # Database schema migrations
│   │   │   ├── 001_initial_schema.js
│   │   │   ├── 002_medallion_schema.js
│   │   │   └── 003_star_schema.js
│   │   │
│   │   ├── query-builders/        # SQL query builders
│   │   │   ├── RequestQueryBuilder.js
│   │   │   └── AnalyticsQueryBuilder.js
│   │   │
│   │   ├── connection/            # Database connection management
│   │   │   ├── SqliteConnection.js
│   │   │   └── ConnectionPool.js
│   │   │
│   │   └── factories/             # Database factories
│   │       └── DatabaseFactory.js
│   │
│   ├── api/                        # External API clients
│   │   ├── BackendApiClient.js    # Backend REST API client
│   │   └── adapters/              # API adapters
│   │       └── BackendApiAdapter.js
│   │
│   ├── storage/                    # Browser storage adapters
│   │   ├── ChromeStorageAdapter.js # Chrome storage implementation
│   │   └── IndexedDBAdapter.js     # IndexedDB implementation
│   │
│   ├── messaging/                  # Chrome messaging adapters
│   │   ├── ChromeMessageBus.js    # Chrome runtime messaging
│   │   └── EventBusAdapter.js     # Event bus implementation
│   │
│   └── capture/                    # Request capture adapters
│       └── WebRequestAdapter.js   # Chrome webRequest API adapter
│
├── presentation/                    # Interface Adapters (UI)
│   ├── popup/
│   │   ├── controllers/           # UI controllers (MVP pattern)
│   │   │   ├── PopupController.js
│   │   │   ├── AuthController.js
│   │   │   └── StatsController.js
│   │   │
│   │   ├── views/                 # View interfaces
│   │   │   ├── PopupView.js
│   │   │   └── AuthView.js
│   │   │
│   │   └── presenters/            # View presenters
│   │       ├── StatsPresenter.js
│   │       └── ChartPresenter.js
│   │
│   ├── options/
│   │   ├── controllers/
│   │   │   ├── OptionsController.js
│   │   │   └── DashboardController.js
│   │   │
│   │   ├── views/
│   │   │   └── DashboardView.js
│   │   │
│   │   └── presenters/
│   │       ├── AnalyticsPresenter.js
│   │       └── ExportPresenter.js
│   │
│   └── devtools/
│       ├── controllers/
│       │   └── DevtoolsController.js
│       │
│       └── presenters/
│           └── NetworkPresenter.js
│
├── shared/                          # Shared utilities (NO business logic)
│   ├── utils/                      # Pure utility functions
│   │   ├── date-utils.js
│   │   ├── format-utils.js
│   │   └── validation-utils.js
│   │
│   ├── constants/                  # Application constants
│   │   ├── timeframes.js
│   │   ├── error-codes.js
│   │   └── config.js
│   │
│   └── helpers/                    # Helper functions
│       ├── async-helpers.js
│       └── dom-helpers.js
│
└── di/                             # Dependency Injection
    ├── container.js                # DI container implementation
    ├── bindings.js                 # Dependency bindings
    └── providers/                  # Service providers
        ├── DatabaseProvider.js
        ├── RepositoryProvider.js
        └── UseCaseProvider.js
```

---

## Refactoring Phases

### Phase 1: Remove Duplication ✅ HIGH PRIORITY

**Goal**: Eliminate duplicate code and consolidate entry points

**Tasks**:
1. ✅ Move `popup/components/tab-manager.js` → `shared/managers/TabManager.js`
2. ✅ Move `options/components/tab-manager.js` → DELETE (duplicate)
3. ✅ Move `popup/components/settings-manager.js` → `shared/managers/SettingsManager.js`
4. ✅ Move `options/components/settings-manager.js` → DELETE (duplicate)
5. ✅ Merge `background-medallion.js` into `background.js`
6. ✅ Update all imports to use new shared managers

**Benefits**:
- Reduces codebase by ~500 lines
- Single source of truth
- Easier maintenance
- Better testability

---

### Phase 2: Extract Domain Layer 🎯 HIGH PRIORITY

**Goal**: Create pure business logic layer with zero external dependencies

**Tasks**:
1. Create `domain/entities/` with core business objects
2. Create `domain/value-objects/` for immutable data structures
3. Create `domain/repositories/` with interface contracts
4. Extract business logic from `database/medallion-manager.js` to domain services
5. Create domain events for important business events

**Benefits**:
- Pure business logic, easy to test
- No framework dependencies
- Clear domain model
- Self-documenting code

---

### Phase 3: Create Application Layer ⚡ HIGH PRIORITY

**Goal**: Define use cases and application orchestration

**Tasks**:
1. Extract use cases from current managers
2. Create application services for orchestration
3. Define DTOs for data transfer
4. Create port interfaces for external adapters

**Benefits**:
- Clear application flow
- Use cases document system capabilities
- Easy to add new features
- Testable application logic

---

### Phase 4: Refactor Infrastructure 🔧 MEDIUM PRIORITY

**Goal**: Implement adapters for external systems

**Tasks**:
1. Implement Repository Pattern with concrete classes
2. Create query builders to abstract SQL
3. Create database factory for connection management
4. Create adapters for Chrome APIs
5. Implement storage adapters

**Benefits**:
- Swappable implementations
- Easier to mock for testing
- Clear boundaries
- Flexible architecture

---

### Phase 5: Implement Dependency Injection 💉 MEDIUM PRIORITY

**Goal**: Remove hard-coded dependencies

**Tasks**:
1. Create DI container
2. Define service providers
3. Register all dependencies
4. Enable constructor injection everywhere
5. Remove manual instantiation

**Benefits**:
- Loose coupling
- Easy to test (inject mocks)
- Configuration over code
- Better code organization

---

### Phase 6: Clean Presentation Layer 🎨 LOW PRIORITY

**Goal**: Separate UI logic from business logic

**Tasks**:
1. Implement MVP pattern for UI
2. Create controllers for user interactions
3. Create presenters for data formatting
4. Separate views from logic

**Benefits**:
- Testable UI logic
- Reusable presenters
- Clear separation
- Better UX consistency

---

## Implementation Timeline

| Phase | Priority | Estimated Time | Status |
|-------|----------|----------------|--------|
| 1. Remove Duplication | HIGH | 30 minutes | ✅ DONE |
| 2. Extract Domain | HIGH | 2 hours | 🔄 IN PROGRESS |
| 3. Application Layer | HIGH | 1.5 hours | ⏳ PENDING |
| 4. Infrastructure | MEDIUM | 2 hours | ⏳ PENDING |
| 5. Dependency Injection | MEDIUM | 1 hour | ⏳ PENDING |
| 6. Presentation Layer | LOW | 1.5 hours | ⏳ PENDING |
| **TOTAL** | | **~8.5 hours** | |

---

## Benefits of Clean Architecture

### 1. **Testability** 🧪
- Domain logic has zero dependencies
- Easy to unit test
- Mock external dependencies
- Fast test execution

### 2. **Maintainability** 🔧
- Clear separation of concerns
- Easy to locate code
- Changes isolated to specific layers
- Self-documenting structure

### 3. **Scalability** 📈
- Add features without breaking existing code
- Clear extension points
- Modular architecture
- Team can work in parallel

### 4. **Flexibility** 🔄
- Swap implementations easily
- Change database without touching business logic
- Migrate to different framework
- A/B test different approaches

### 5. **Team Collaboration** 👥
- Clear boundaries between modules
- Parallel development possible
- Easy onboarding
- Consistent patterns

### 6. **Code Reuse** ♻️
- Shared domain logic
- Reusable use cases
- Common infrastructure
- DRY principle enforced

### 7. **Documentation** 📚
- Code structure tells the story
- Use cases document features
- Domain model is clear
- Easy to understand

---

## Naming Conventions

**Clarity and Consistency**:

- **Entities**: Nouns (Request, Domain, User)
- **Value Objects**: Descriptive nouns (TimeRange, OHLCData)
- **Services**: Verb-Noun pattern (RequestAnalyzer, QualityCalculator)
- **Use Cases**: Verb phrase (CaptureRequest, GenerateOHLC)
- **Repositories**: I{Entity}Repository (IRequestRepository)
- **DTOs**: {Entity}DTO (RequestDTO)
- **Controllers**: {Feature}Controller (PopupController)
- **Presenters**: {Feature}Presenter (StatsPresenter)

---

## Breaking Changes

**NONE** ✅

All refactoring is internal. Public APIs remain unchanged. Extension continues to work normally during and after refactoring.

---

## Success Metrics

### Before Refactoring:
- **Layer Separation**: 20%
- **SOLID Compliance**: 30%
- **Code Duplication**: 15%
- **Testability**: 40%
- **Maintainability**: 50%

### After Refactoring (Goal):
- **Layer Separation**: 95%
- **SOLID Compliance**: 90%
- **Code Duplication**: 0%
- **Testability**: 95%
- **Maintainability**: 95%

---

## Conclusion

This refactoring transforms the codebase from a working but architecturally mixed implementation to a clean, maintainable, and scalable architecture following industry best practices.

The investment in clean architecture pays dividends in:
- Faster feature development
- Easier bug fixes
- Better team collaboration
- Higher code quality
- Lower technical debt

**Let's build something beautiful! 🚀**
