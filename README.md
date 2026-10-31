# TestCase Studio

A professional, fully client-side **Test Case Generator & Management** web application built with vanilla HTML5, CSS3, and JavaScript. No frameworks, no build step, no backend required.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)

---

## Overview

TestCase Studio helps software testers, QA engineers, developers, and students create, manage, organize, and evaluate software test cases efficiently — all from a single HTML file with no installation required.

---

## Features

| Feature | Details |
|---|---|
| **Dashboard** | Live stats (total, passed, failed, blocked, not run, projects), CSS bar chart, recent activity |
| **Test Case CRUD** | Create, view, edit, delete with auto-generated IDs (`TC-0001`, `TC-0002`, …) |
| **Multi-step Editor** | Add, edit, reorder (↑↓), and remove individual test steps |
| **Project Management** | Create / edit / delete projects; cascade-delete with confirmation |
| **Rule-based Generator** | Structured test case generation from feature inputs — no API key needed |
| **Execution Tracking** | Record status (Not Run / Passed / Failed / Blocked), actual results, and notes |
| **Search, Filter & Sort** | Filter by project, priority, type, status; sort by date, title, priority |
| **CSV Export** | Export all or filtered test cases to a properly escaped `.csv` file |
| **CSV Import** | Upload CSV with validation, row preview, and duplicate ID detection |
| **Data Persistence** | All data saved to `localStorage`; survives page refresh |
| **Sample Data** | One-click sample dataset for demonstration |
| **Dark Theme** | Professional dark UI with color-coded badges and status indicators |
| **Responsive** | Works on desktop, tablet, and mobile |

---

## Getting Started

### Option 1 — Open directly in a browser

```
1. Clone or download this repository.
2. Open index.html in any modern browser (Chrome, Firefox, Edge, Safari).
3. No server, no install, no build step needed.
```

### Option 2 — Serve locally (optional)

If you prefer to run it through a local server (e.g., to avoid any browser file-protocol restrictions):

```bash
# Python 3
python -m http.server 8080

# Node.js (npx)
npx serve .
```

Then open `http://localhost:8080` in your browser.

---

## File Structure

```
testcase-studio/
├── index.html   # Application shell — all sections, modals, navigation
├── style.css    # Dark theme, responsive layout, badges, charts
├── script.js    # All application logic — CRUD, generation, import/export
└── README.md
```

All three files must remain in the **same directory**.

---

## Usage Guide

### Dashboard
The dashboard updates automatically whenever test cases are created, modified, or deleted. It displays a breakdown of execution statuses and a list of the six most recently updated test cases.

### Creating a Test Case
1. Navigate to **Test Cases** → click **+ New Test Case**.
2. Fill in the title, project, scenario, preconditions, test steps, expected result, priority, type, and status.
3. At least one test step is required.
4. Click **Save Test Case** — the ID is generated automatically.

### Using the Generator
1. Navigate to **Generator**.
2. Fill in the feature name, description, objective, scenario, and expected behavior.
3. Click **Generate Test Case** — a structured test case is produced from your inputs.
4. Review and save the generated case, or discard it.

### Recording Execution Results
1. Navigate to **Execution**.
2. Click **Record** next to any test case.
3. Set the execution status, enter the actual result and any notes, then click **Save Result**.

### Importing Test Cases (CSV)
Required columns (case-sensitive in header row):

```
title, projectId, scenario, preconditions, expectedResult, priority, type, status
```

Optional columns: `id, actualResult, notes, steps, createdAt`

- `priority` must be one of: `Low`, `Medium`, `High`, `Critical`
- `type` must be one of: `Functional`, `UI`, `Integration`, `Regression`, `Performance`, `Security`
- `status` must be one of: `Not Run`, `Passed`, `Failed`, `Blocked`
- `steps` format: `1. Step one | 2. Step two | 3. Step three`

### Exporting Test Cases (CSV)
Navigate to **Import / Export** → choose **All Test Cases** or **Current Filter** → click **Export to CSV**.

---

## Data Model

```js
Project {
  id          // "PRJ-XXXXX"
  name        // string
  description // string
  createdAt   // ISO 8601
  updatedAt   // ISO 8601
}

TestCase {
  id             // "TC-0001"
  title          // string
  projectId      // ref → Project.id
  scenario       // string  (objective / scenario description)
  preconditions  // string
  steps          // Step[]
  expectedResult // string
  actualResult   // string
  priority       // "Low" | "Medium" | "High" | "Critical"
  type           // "Functional" | "UI" | "Integration" | "Regression" | "Performance" | "Security"
  status         // "Not Run" | "Passed" | "Failed" | "Blocked"
  notes          // string
  createdAt      // ISO 8601
  updatedAt      // ISO 8601
}

Step {
  id          // internal uid
  description // string
  order       // number (1-based)
}
```

Data is stored in `localStorage` under the keys `tcs_projects` and `tcs_testcases`.

---

## Browser Compatibility

| Browser | Minimum Version |
|---|---|
| Chrome / Edge | 88+ |
| Firefox | 85+ |
| Safari | 14+ |

Uses standard ES2020 features (`optional chaining`, `nullish coalescing`, `Array.matchAll`). No polyfills required for the browsers listed above.

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request.

Please keep the no-framework constraint and ensure the application runs without a build process.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Screenshots

> Load `index.html` in your browser and click **Load Sample Data** in the sidebar to see the application populated with example projects and test cases.
