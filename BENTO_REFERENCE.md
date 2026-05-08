# Bento Box Grid Reference

This document serves as a quick reference for the project module sizing and styling options used in `assets/js/project-data.js`.

## Module Sizes

Use the `size` property to define the grid dimensions of each project card.

| Size Name | Grid Units (W x H) | Description |
| :--- | :--- | :--- |
| `small` | **1 x 1** | Smallest square. Hides image, enlarges text. |
| `medium` | **2 x 1** | Wide rectangle. |
| `large` | **2 x 2** | Large square. Features a larger image display. |
| `wide` | **3 x 1** | Ultra-wide rectangle. |
| `tall` | **1 x 2** | Tall vertical rectangle. |

---

## Tag Colors

Use the `color` property within the `tags` array to style the labels.

- `blue`
- `green`
- `purple`
- `orange`
- `rose`
- `cyan`
- `amber`
- `white`
- `gray`

---

## Implementation Details

The grid is defined in `style.css` using `grid-template-columns: repeat(4, 1fr)` and `grid-auto-rows: 300px` for desktop views.

### Example Schema
```javascript
{
    id: "project-id",
    title: "Project Title",
    subtitle: "Brief description...",
    size: "medium", // <--- Size goes here
    tags: [
        { label: "New", color: "blue" } // <--- Color goes here
    ],
    // ... other properties
}
```
