const { createApp } = Vue;

createApp({
  data() {
    return {
      devMode: false,
      visible: false,
      showInput: false,
      searchQuery: '',
      style: {
        fontSize: 'm',
        descriptionsidebar: null
      },
      desc: {
        data: null,
        show: false
      },
      job: null,
      language: {},
      location: {},
      categories: [],
      consumables: {},
      currentRoute: 'home',
      activeCraftable: null,
      quantity: 1,
      min: 1,
      max: 10,
      crafttime: 15000,
      allCraftables: [],
      imageCache: {}, // Stores resolved image URLs (item or placeholder) after preloading
      itemLabels: {}, // To store item_name: "Display Label"
      itemLimits: {}, // To store item_name: limit
      filterByInventory: false,
      inventory: {}, // Player's inventory
      testData: [
        {
          Text: "Meat Breakfast",
          SubText: "InvMax = 10",
          Desc: "Recipe: 1x Apple, 1x Water, 1x Sugar, 1x Egg, 1x Flour",
          Items: [
              { name: "meat", count: 1 },
              { name: "salt", count: 1 }
          ],
          Reward: [ { name: "consumable_breakfast", count: 1 } ],
          Job: 0, 
          Location: 0,
          Category: "food"
        }
      ],
      testCategory: [
        { ident: 'food', text: 'Craft Food', Job: 0, Location: 0 }
      ]
    };
  },
  mounted() {
    // Window Event Listeners
    window.addEventListener("message", this.onMessage);
    window.addEventListener("keydown", this.onKeypress);

    // Debug only
    if (this.devMode) {
      let devData = {
        craftables: this.testData,
        categories: this.testCategory,
        crafttime: 15000,
        style: {
          fontSize: 'm',
          descriptionsidebar: true
        },
        language: {
          InputHeader: 'How many {{msg}} do you want to craft?',
          InputCraft: 'Craft Item',
          InputCancel: 'Cancel',
          BackButton: 'Back',
          ExitButton: 'Exit',
          CraftHeader: 'Recipe Crafting',
          CraftText: 'Press [~e~G~q~] to Craft',
          InvalidAmount: 'Invalid Amount',
          Crafting: 'Crafting...',
          FinishedCrafting: 'You finished crafting',
          PlaceFire: "You're placing a campfire...",
          PutOutFire: 'Putting out the campfire...',
          NotEnough: 'Not enough material for this recipe',
          NotJob: 'You dont have the required job ',
          SearchPlaceholder: 'Search recipes...',
          AllCategories: 'All Categories',
          NoRecipesFound: 'No matching recipes found',
          IngredientsLabel: 'Ingredients:',
          RewardLabel: 'Reward:'
        }
      };
      this.setData(devData);
      this.visible = true;
    }
  },
  beforeUnmount() {
    // Remove listeners when UI is destroyed to save on memory
    window.removeEventListener("message", this.onMessage);
    window.removeEventListener('keydown', this.onKeypress);
  },
  computed: {
    fontClass() {
      let fontc = {};

      switch(this.style.fontSize) {
        case 's':
          fontc['smallfont'] = true;
          break;
        case 'm':
          fontc['mediumfont'] = true;
          break;
        case 'l':
          fontc['largefont'] = true;
          break;
        default:
          fontc['mediumfont'] = true;
          break; 
      }

      return fontc;
    },
    InputCraftText() {
      return this.activeCraftable && this.activeCraftable.Text && this.language.InputHeader ? 
        this.language.InputHeader.replace('{{msg}}', this.activeCraftable.Text) : 
        'How many do you want to craft?';
    },
    
    // Get all craftable items across all categories for the main view
    filteredItems() {
      let filtered = this.allCraftables;
      
      // Apply search filter
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(item => 
          (item.Text && item.Text.toLowerCase().includes(query)) || 
          (item.SubText && item.SubText.toLowerCase().includes(query)) ||
          (item.Desc && item.Desc.toLowerCase().includes(query)) ||
          (item.Reward && item.Reward.some(rew => this.getItemDisplayLabel(rew.name).toLowerCase().includes(query))) ||
          item.Items.some(ing => this.getItemDisplayLabel(ing.name).toLowerCase().includes(query))
        );
      }
      
      // Apply inventory filter if enabled
      if (this.filterByInventory) {
        filtered = filtered.filter(item => this.playerHasAllIngredients(item));
      }
      
      // After Vue renders the filtered items
      this.$nextTick(() => this.applyDynamicCategoryStyles());
      
      return filtered;
    },
    
    // Check if no recipes are found after filtering
    noRecipesFound() {
      if (this.currentRoute === 'home') {
        return this.filteredItems.length === 0;
      } else {
        return this.filteredCategoryItems(this.currentRoute).length === 0;
      }
    },
    
    // Get maximum craftable quantity for the active recipe
    maxCraftableQuantity() {
      if (!this.activeCraftable || !this.activeCraftable.Items) return 1;
      
      return this.calculateMaxCraftable(this.activeCraftable);
    },
    
    // Get the effective maximum considering both crafting limits and inventory space
    effectiveMaxCraftable() {
      if (!this.activeCraftable) return 1;
      
      const maxFromIngredients = this.calculateMaxCraftable(this.activeCraftable);
      const maxFromInventorySpace = this.calculateMaxCraftableByInventorySpace(this.activeCraftable);
      
      return Math.min(maxFromIngredients, maxFromInventorySpace);
    }
  },
  methods: {
    onMessage(event) {
      switch(event.data.type) {
        case "vorp-craft-open":
          this.setData(event.data);
          this.visible = true;
          break;
        case "vorp-craft-animate":
          this.animationPlaying();
          break;
        case "vorp-craft-inventory-update":
          // Handle inventory updates from server
          if (event.data.inventory) {
            this.inventory = event.data.inventory;
            this.$forceUpdate();
          }
          break;
        default:
          break;
      }
    },
    onKeypress(event) {
      if (event.key === "I" || event.key === "i") {
        fetch(`https://${GetParentResourceName()}/vorp-openinv`, {
          method: 'POST'
        });
      }

      if (event.key === "Escape") {
        if (this.showInput) {
          this.showInput = false; // First close the quantity dialog if open
        } else {
          this.closeView(); // Then close the whole UI
        }
      }
    },
    
    // Filter items within a specific category
    filteredCategoryItems(category) {
      if (!this.consumables[category]) return [];
      
      let filtered = this.consumables[category];
      
      // Apply search filter
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(item => 
          (item.Text && item.Text.toLowerCase().includes(query)) || 
          (item.SubText && item.SubText.toLowerCase().includes(query)) ||
          (item.Desc && item.Desc.toLowerCase().includes(query)) ||
          (item.Reward && item.Reward.some(rew => this.getItemDisplayLabel(rew.name).toLowerCase().includes(query))) ||
          item.Items.some(ing => this.getItemDisplayLabel(ing.name).toLowerCase().includes(query))
        );
      }
      
      // Apply inventory filter if enabled
      if (this.filterByInventory) {
        filtered = filtered.filter(item => this.playerHasAllIngredients(item));
      }
      
      // After Vue renders the filtered items
      this.$nextTick(() => this.applyDynamicCategoryStyles());
      
      return filtered;
    },
    
    // Check if player has all required ingredients for a recipe
    playerHasAllIngredients(recipe) {
      if (!recipe.Items || !recipe.Items.length) return true;
      
      for (const ingredient of recipe.Items) {
        const requiredCount = ingredient.count;
        const playerCount = this.inventory[ingredient.name] || 0;
        
        if (playerCount < requiredCount) {
          return false;
        }
      }
      
      return true;
    },
    
    animationPlaying() {
      this.visible = false;
        
      setTimeout(() => {
        this.visible = true;
      }, this.crafttime);
    },
    
    craftItem() {
      if (!this.activeCraftable) return;
      
      fetch(`https://${GetParentResourceName()}/vorp-craftevent`, {
        method: 'POST',
        body: JSON.stringify({
          craftable: this.activeCraftable,
          quantity: this.quantity,
          location: this.location
        })
      }).then(resp => resp.json()).then(resp => {
        // Update inventory after successful crafting
        this.updateInventoryAfterCrafting(this.activeCraftable, this.quantity);
        
        this.showInput = false;
        this.activeCraftable = null;
        this.quantity = 1;
      }).catch(function (error) {
        console.warn(error);
      });
    },
    
    // Update local inventory after crafting to reflect new amounts
    updateInventoryAfterCrafting(recipe, quantity) {
      if (!recipe.Items) return;
      
      // Subtract ingredients used
      recipe.Items.forEach(ingredient => {
        const totalUsed = ingredient.count * quantity;
        if (this.inventory[ingredient.name]) {
          this.inventory[ingredient.name] = Math.max(0, this.inventory[ingredient.name] - totalUsed);
        }
      });
      
      // Add rewards received (if tracking inventory for rewards)
      if (recipe.Reward) {
        recipe.Reward.forEach(reward => {
          const totalReceived = reward.count * quantity;
          if (this.inventory[reward.name]) {
            this.inventory[reward.name] += totalReceived;
          } else {
            this.inventory[reward.name] = totalReceived;
          }
        });
      }
      
      // Force reactivity update
      this.$forceUpdate();
    },
    
    handleItemClick(data) {
      this.activeCraftable = data;
      this.showInput = true;
    },
    
    // Calculate how many times a recipe can be crafted based on inventory
    calculateMaxCraftable(recipe) {
      if (!recipe.Items || !recipe.Items.length) return 999; // No ingredients required
      
      let maxCraftable = 999;
      
      for (const ingredient of recipe.Items) {
        const requiredCount = ingredient.count;
        const playerCount = this.inventory[ingredient.name] || 0;
        const possibleCrafts = Math.floor(playerCount / requiredCount);
        
        if (possibleCrafts < maxCraftable) {
          maxCraftable = possibleCrafts;
        }
      }
      
      return Math.max(0, maxCraftable);
    },
    
    // Calculate max craftable based on inventory space for the reward items
    calculateMaxCraftableByInventorySpace(recipe) {
      if (!recipe.Reward || !recipe.Reward.length) return 999;
      
      let maxCraftable = 999;
      
      for (const reward of recipe.Reward) {
        const currentCount = this.inventory[reward.name] || 0;
        const maxLimit = this.getItemLimit(reward.name);
        const rewardPerCraft = reward.count;
        
        if (maxLimit > 0) { // Only check if there's a limit set
          const availableSpace = maxLimit - currentCount;
          const possibleCrafts = Math.floor(availableSpace / rewardPerCraft);
          
          if (possibleCrafts < maxCraftable) {
            maxCraftable = possibleCrafts;
          }
        }
      }
      
      return Math.max(0, maxCraftable);
    },
    
    // Get inventory information for a specific reward item
    getInventoryInfo(recipe) {
      if (!recipe.Reward || !recipe.Reward.length) {
        return { current: 0, max: 0, canFit: 999 };
      }
      
      const primaryReward = recipe.Reward[0]; // Use the first reward item for display
      const current = this.inventory[primaryReward.name] || 0;
      const max = this.getItemLimit(primaryReward.name) || 0;
      const rewardPerCraft = primaryReward.count;
      
      let canFit = 999;
      if (max > 0) {
        const availableSpace = max - current;
        canFit = Math.floor(availableSpace / rewardPerCraft);
      }
      
      return { current, max, canFit };
    },
    
    // Set quantity to effective maximum (considering both ingredients and inventory space)
    setMaxQuantity() {
      this.quantity = this.effectiveMaxCraftable;
    },
    
    formatQuantity() {
      if (this.quantity <= this.min - 1) {
          this.quantity = this.min;
      }

      // Use the effective max that considers both ingredients and inventory space
      const effectiveMax = Math.min(this.max, this.effectiveMaxCraftable);
      if (this.quantity > effectiveMax) {
          this.quantity = effectiveMax;
      }
    },
    
    increase() {
        let value = this.quantity;
        value = isNaN(value) ? this.min : value;

        // Use the effective max that considers both ingredients and inventory space
        const effectiveMax = Math.min(this.max, this.effectiveMaxCraftable);
        if (value >= effectiveMax) {
            value = effectiveMax - 1;
        }

        value++;
        this.quantity = value;
    },
    
    decrease() {
        let value = this.quantity;
        value = isNaN(value) ? this.min : value;
        value < this.min ? value = this.min : '';
        value--;
        value < this.min ? value = this.min : '';
        this.quantity = value;
    },
    
    closeView() {
      this.visible = false;
      this.searchQuery = '';
      this.currentRoute = 'home';
      fetch(`https://${GetParentResourceName()}/vorp-craft-close`, {
        method: 'POST'
      });
    },
    
    // Core preloading logic for a single item
    _doPreloadItemImage(itemName) {
      return new Promise((resolve) => {
        const safeItemName = typeof itemName === 'string' ? itemName : 'placeholder';
        // Use nui:// protocol to access vorp_inventory images
        const inventoryResourceName = 'vorp_inventory'; // Make sure this matches the actual resource name
        const itemPath = `nui://${inventoryResourceName}/html/img/items/${encodeURIComponent(safeItemName)}.png`;
        const placeholderPath = `nui://${inventoryResourceName}/html/img/items/placeholder.png`;
        
        const img = new Image();
        img.onload = () => {
          this.imageCache[safeItemName] = `url('${itemPath}')`;
          resolve(this.imageCache[safeItemName]);
        };
        img.onerror = () => {
          // If NUI path fails, it implies an issue with resource access or file existence.
          // Fallback to a local placeholder if one exists in vorp_crafting, or keep the NUI placeholder path.
          // For simplicity, we'll assume the NUI placeholder path is the ultimate fallback.
          this.imageCache[safeItemName] = `url('${placeholderPath}')`; 
          resolve(this.imageCache[safeItemName]);
        };
        img.src = itemPath; 
      });
    },

    // Manages preloading promises and updates imageCache
    preloadItemImage(itemName) {
      const safeItemName = typeof itemName === 'string' ? itemName : 'placeholder';
      const inventoryResourceName = 'vorp_inventory';
      const placeholderUrlString = `url('nui://${inventoryResourceName}/html/img/items/placeholder.png')`;

      if (!safeItemName || safeItemName === 'placeholder') {
        this.imageCache[safeItemName] = placeholderUrlString;
        return Promise.resolve(placeholderUrlString);
      }

      if (this.imageCache.hasOwnProperty(safeItemName)) {
        if (typeof this.imageCache[safeItemName] === 'string') {
          return Promise.resolve(this.imageCache[safeItemName]);
        }
        return this.imageCache[safeItemName]; // Return existing promise
      }

      const preloadPromise = this._doPreloadItemImage(safeItemName);
      this.imageCache[safeItemName] = preloadPromise; 

      preloadPromise.then(finalUrlString => {
        this.imageCache[safeItemName] = finalUrlString; 
      }).catch(() => {
        this.imageCache[safeItemName] = placeholderUrlString; 
      });

      return preloadPromise;
    },

    // Iterates through all craftables to preload all unique item images
    async preloadAllItemImages(craftables) {
      const itemNames = new Set();
      craftables.forEach(recipe => {
        if (recipe.Reward && recipe.Reward.length > 0) {
          recipe.Reward.forEach(reward => itemNames.add(reward.name));
        } else {
          itemNames.add('placeholder'); // Default for recipes without a specific reward image
        }
        if (recipe.Items && recipe.Items.length > 0) {
          recipe.Items.forEach(ingredient => itemNames.add(ingredient.name));
        }
      });

      const preloadPromises = [];
      itemNames.forEach(name => {
        if (name) { // Ensure name is not undefined/null
          preloadPromises.push(this.preloadItemImage(name));
        } else {
          preloadPromises.push(this.preloadItemImage('placeholder'));
        }
      });
      
      await Promise.allSettled(preloadPromises); // Wait for all preloads to settle
      // Vue should react to imageCache updates. If not, a $forceUpdate might be considered, but usually not needed.
    },

    getItemImageUrl(itemName) {
      const safeItemName = typeof itemName === 'string' ? itemName : 'placeholder';
      const inventoryResourceName = 'vorp_inventory';
      const placeholderUrlString = `url('nui://${inventoryResourceName}/html/img/items/placeholder.png')`;

      if (!safeItemName || safeItemName === 'placeholder') {
        return placeholderUrlString;
      }
      
      const cachedEntry = this.imageCache[safeItemName];
      if (typeof cachedEntry === 'string') {
        return cachedEntry; // URL string is resolved and cached
      }
      // If it's a promise (still loading) or not in cache yet, return placeholder URL string
      return placeholderUrlString; 
    },
    
    // Get item display label
    getItemDisplayLabel(itemName) {
      return this.itemLabels[itemName] || itemName;
    },
    
    // Get item limit
    getItemLimit(itemName) {
      return this.itemLimits[itemName] || 0;
    },
    
    // Initialize dynamic category colors
    initCategoryColors() {
      // Get all category chips after DOM is updated
      this.$nextTick(() => {
        // Get category order from config or use the DOM elements
        const categories = document.querySelectorAll('.category-chip');
        
        // Apply numbered styles to categories
        categories.forEach((cat, index) => {
          // Get category name from data attribute
          const catName = cat.getAttribute('data-category');
          if (!catName) return;
          
          // Calculate the category color number (starting from 1)
          const colorNum = (index % 12) + 1;
          
          // Apply styles to category chips
          cat.style.background = `var(--cat${colorNum})`;
          
          // Find and style recipe cards for this category
          const cards = document.querySelectorAll(`.recipe-card[data-category="${catName}"]`);
          cards.forEach(card => {
            card.style.background = `var(--cat${colorNum}-bg)`;
            card.style.borderColor = `var(--cat${colorNum})`;
          });
        });
      });
    },
    
    async setData(data) {
      let craftables = data.craftables;
      let categories = data.categories;
      let crafttime = data.crafttime;
      let style = data.style;
      let language = data.language;
      let location = data.location;
      let charJob = data.job;
      let itemLabels = data.itemLabels || {}; 
      let itemLimits = data.itemLimits || {};
      let inventory = data.inventory || {};

      let consumables = {};
      let filteredcat = [];
      let allCraftableItems = [];
      
      // Setup object with keys
      if (categories && Array.isArray(categories)) {
        categories.forEach(cat => {
          consumables[cat.ident] = [];
          let jobcheck = cat.Job === 0 ? true : (Array.isArray(cat.Job) && cat.Job.some(j => j === charJob));

          if (jobcheck) {
            if (cat.Location == 0) {
              filteredcat.push(cat);
            } else {
              if (Array.isArray(cat.Location)) {
                for (let locId of cat.Location) {
                  if (locId == location?.id) {
                    filteredcat.push(cat);
                    break;
                  }
                }
              }
            }
          }
        });
      }

      // Fill object created above
      if (craftables && Array.isArray(craftables)) {
        craftables.forEach(item => {
          let jobcheck = item.Job === 0 ? true : (Array.isArray(item.Job) && item.Job.some(j => j === charJob));

          if (jobcheck) {
            if (item.Location == 0) {
              if (consumables[item.Category]) {
                consumables[item.Category].push(item);
                allCraftableItems.push(item);
              }
            } else {
              if (Array.isArray(item.Location)) {
                for (let locId of item.Location) {
                  if (locId == location?.id) {
                    if (consumables[item.Category]) {
                      consumables[item.Category].push(item);
                      allCraftableItems.push(item);
                    }
                    break;
                  }
                }
              }
            }
          }
        });
      }

      this.language = language;
      this.consumables = consumables;
      this.categories = filteredcat;
      this.crafttime = crafttime;
      this.style = style;
      this.location = location;
      this.allCraftables = allCraftableItems;
      this.itemLabels = itemLabels;
      this.itemLimits = itemLimits;
      this.inventory = inventory; // Store the player's inventory
      
      // Initialize category colors after data is loaded
      this.initCategoryColors();
      
      this.imageCache = {}; 
      if (this.allCraftables && this.allCraftables.length > 0) {
        await this.preloadAllItemImages(this.allCraftables); // Ensure preloading completes
        // Force Vue to re-render if necessary, though changes to imageCache should be reactive.
        // For complex non-reactive updates, this.$forceUpdate() could be a last resort, but try to avoid.
      }
    },
    
    // Called after filtering recipes to re-apply styles
    applyDynamicCategoryStyles() {
      this.$nextTick(() => {
        // Get all visible category chips
        const categories = document.querySelectorAll('.category-chip');
        const categoryMap = {};
        
        // Create map of category names to color numbers
        categories.forEach((cat, index) => {
          const catName = cat.getAttribute('data-category');
          if (catName) {
            categoryMap[catName] = (index % 12) + 1;
          }
        });
        
        // Apply styles to visible recipe cards
        const visibleCards = document.querySelectorAll('.recipe-card');
        visibleCards.forEach(card => {
          const catName = card.getAttribute('data-category');
          if (catName && categoryMap[catName]) {
            const colorNum = categoryMap[catName];
            card.style.background = `var(--cat${colorNum}-bg)`;
            card.style.borderColor = `var(--cat${colorNum})`;
          }
        });
      });
    },
  },
}).mount("#app");
