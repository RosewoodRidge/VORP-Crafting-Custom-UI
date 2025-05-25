Visit [Rosewood Ridge](https://rosewoodridge.xyz) to join our community and Discord!

---

# VORP Crafting - Modern UI Update by Poggy

A complete visual overhaul of the VORP Crafting interface with improved functionality and a modern design aesthetic.

## Before & After

### Original UI
![Before](https://user-images.githubusercontent.com/10902965/172357712-0d486141-dcc1-40d3-ad90-1b3e8b0b5fca.png)
*The original VORP Crafting interface with basic styling and limited visual feedback*

### New Modern UI
![After](https://imgur.com/WGhEFMl.png)
*The redesigned interface with category coloring, inventory integration, and improved visual hierarchy*

## New Features

- **Dynamic Category Styling**: Categories are automatically assigned colors from a predefined palette
- **Inventory Integration**: Filter recipes based on what you can actually craft with your current inventory
- **Item Limits Display**: See maximum inventory capacity for each craftable item
- **Improved Search**: Find recipes by name, ingredients, or rewards
- **Responsive Design**: Works well on various screen sizes
- **Modern Visual Style**: Clean card-based UI with proper spacing and visual hierarchy
- **Accessibility Improvements**: Better contrast, keyboard navigation support
- **Visual Feedback**: Hover effects and clear button states

## Installation

Installation is simple - just a drag and drop replacement:

1. Download all files from this repository
2. Drag and drop all files into your existing `vorp_crafting` folder, replacing the original files
3. Restart your server

**Important Note**: The `fxmanifest.lua` has been updated to include `vorp_inventory` as a dependency. This is required for the inventory integration features to work properly.

## Configuration

Your existing `config.lua` file will work with this update without modifications. The UI changes are all contained within the UI folder and supporting client/server scripts.

For those using this GitHub version: The config file has been removed to avoid overwriting your custom settings. Simply keep your existing configuration file.

## Technical Notes

- The UI now uses CSS variables for easier theme customization
- Item images are automatically retrieved from vorp_inventory
- Categories are dynamically styled using a sequential color system
- Responsive design principles applied throughout

## Credits

- Original VORP Crafting script by VORP team (@blue)
- UI Redesign by [Your Name/Rosewood Ridge]
- Special thanks to the Rosewood Ridge community


