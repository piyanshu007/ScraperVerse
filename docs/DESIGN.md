# Design

## Visual Identity

WebPulse AI uses a Spider-Verse inspired comic-brutalist design system.

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| --bg-main | #0e001f | Page background (deep purple) |
| --bg-card | #160030 | Card backgrounds |
| --green | #00ccdd | Cyan accent, healthy status, borders |
| --magenta | #cc0055 | Primary accent, error states, header border |
| --yellow | #d4a800 | Amber-gold for labels, indicators, CTA buttons |
| --white | #f0eaff | Primary text (purple-tinted) |
| --white-muted | #a898bb | Secondary text |

### Typography

| Role | Font | Usage |
|---|---|---|
| Headers, badges, stats | Bangers | Comic-style impact headings |
| Body, descriptions | Outfit | Clean readable UI copy |
| Code, selectors, logs | JetBrains Mono | Monospace terminal output |

### Design Tokens

- Block shadows: layered offsets using magenta and yellow to create chromatic aberration
- Background texture: diagonal crosshatch at 4% opacity (Ben-Day dots effect)
- Corner ornaments: SVG cobwebs in magenta/cyan per quadrant
- Side accent bars: gradient strips on left and right edges of viewport

### Component Patterns

**Cards**: Magenta border, yellow shadow frame, offset pseudo-element border. Hover shifts 4px up-left.

**Buttons**:
- btn-green: Cyan fill, black shadow, magenta secondary shadow
- btn-white: Amber fill
- btn-outline: Transparent with magenta border

**Status Badges**: Font is Bangers, uppercase, with colored border and glow shadow matching the status color.

**Terminal**: Dark background (#0a0015), green header bar, monospace output, scrollable with color-coded log levels.

### Responsive Behavior

- Grid-4 collapses to Grid-2 at 1100px, then to 1-column at 768px
- Header padding reduces from 40px to 20px at 768px
- Main container padding reduces from 36px/40px to 16px on mobile
- Tab bar scrolls horizontally on small screens
- Font sizes use clamp() for fluid scaling on the landing hero
- Viewport meta tag enforces width=device-width with initial-scale=1

### Accessibility

- Color contrasts meet WCAG AA for text on dark backgrounds
- Interactive elements have focus-visible outlines
- All icons are decorative and aria-hidden; labels carry the meaning
