uiopen = false

VUI = {}

local Core = exports.vorp_core:GetCore()
local itemLabels = {} -- Cache for item labels
local itemLimits = {} -- Cache for item limits

-- Fetch all item labels and limits from the server
local function fetchItemLabels()
    local response = Core.Callback.TriggerAwait("vorp_crafting:GetAllItemLabels")
    if response then
        itemLabels = response.labels
        itemLimits = response.limits
        return true
    end
    return false
end

-- Fallback function if server labels fail
local function formatItemName(itemName)
    if not itemName then return "Unknown Item" end
    
    -- Simple formatting: replace underscores with spaces and capitalize words
    local s = itemName:gsub("_", " ")
    
    -- Capitalize first letter of each word
    s = s:gsub("(%a)([%w_']*)", function(first, rest)
        return first:upper()..rest:lower()
    end)
    
    -- Remove potential prefixes like "consumable", "ammo", etc.
    local prefixes = {
        "^Consumable ",
        "^Ammo ",
        "^Item ",
        "^Weapon "
    }
    
    for _, prefix in ipairs(prefixes) do
        s = s:gsub(prefix, "")
    end
    
    return s
end

-- Get item label - either from server or formatted fallback
local function getItemLabel(itemName)
    -- First try to get the label from our cache
    if itemLabels[itemName] then
        return itemLabels[itemName]
    end
    
    -- If not found, use the fallback formatter
    return formatItemName(itemName)
end

-- Get player inventory
local function getPlayerInventory()
    local inventory = {}
    local playerItems = Core.Callback.TriggerAwait("vorp_crafting:GetPlayerInventory")
    
    if playerItems then
        -- Convert to a format that's easier to use in the UI
        for _, item in pairs(playerItems) do
            inventory[item.name] = item.count
        end
    end
    
    return inventory
end

-- openUI
VUI.OpenUI = function(location)
    local allText = _all()

    if allText then
        uiopen = true
        local Categories = {}

        if location.Categories == 0 or location.Categories == nil then
            Categories = Config.Categories
        else
            for keyloc, loccat in pairs(location.Categories) do
                for keycat, cat in ipairs(Config.Categories) do
                    if loccat == cat.ident then
                        Categories[#Categories + 1] = cat
                        break
                    end
                end
            end
        end

        -- Fetch item labels and limits from the server
        fetchItemLabels()

        -- Fetch player inventory
        local playerInventory = getPlayerInventory()

        -- Gather all unique item names that need labels
        local uniqueItemNames = {}
        local processedLabels = {}
        local processedLimits = {} -- New table for limits

        if Config.Crafting then
            for _, recipe in ipairs(Config.Crafting) do
                if recipe.Items then
                    for _, ingredient in ipairs(recipe.Items) do
                        if ingredient.name and not uniqueItemNames[ingredient.name] then
                            uniqueItemNames[ingredient.name] = true
                            processedLabels[ingredient.name] = getItemLabel(ingredient.name)
                            processedLimits[ingredient.name] = itemLimits[ingredient.name] or 0
                        end
                    end
                end
                if recipe.Reward then
                    for _, rewardItem in ipairs(recipe.Reward) do
                        if rewardItem.name and not uniqueItemNames[rewardItem.name] then
                            uniqueItemNames[rewardItem.name] = true
                            processedLabels[rewardItem.name] = getItemLabel(rewardItem.name)
                            processedLimits[rewardItem.name] = itemLimits[rewardItem.name] or 0
                        end
                    end
                end
            end
        end

        if Config.KneelingAnimation then
            Animations.forceRestScenario(true)
        end
        
        SendNUIMessage({
            type = 'vorp-craft-open',
            craftables = Config.Crafting,
            categories = Categories,
            crafttime = Config.CraftTime,
            style = Config.Styles,
            language = allText,
            location = location,
            job = LocalPlayer.state.Character.Job,
            itemLabels = processedLabels, -- Send the collected labels
            itemLimits = processedLimits, -- Send the collected limits
            inventory = playerInventory -- Send player inventory
        })
        
        SetNuiFocus(true, true)
    end
end

VUI.Animate = function()
    SendNUIMessage({
        type = 'vorp-craft-animate'
    })
    SetNuiFocus(true, false)
end

VUI.Refocus = function()
    SetNuiFocus(true, true)
end

RegisterNUICallback('vorp-craft-close', function(args, cb)
    SetNuiFocus(false, false)
    uiopen = false
    if Config.KneelingAnimation then
        Animations.forceRestScenario(false)
    end
    cb('ok')
end)

RegisterNUICallback('vorp-openinv', function(args, cb)
    TriggerServerEvent('vorp:openInv')
    cb('ok')
end)

RegisterNUICallback('vorp-craftevent', function(args, cb)
    local count = tonumber(args.quantity)
    if count ~= nil and count ~= 'close' and count ~= '' and count > 0 then
        TriggerServerEvent('vorp:startcrafting', args.craftable, count, args.location)
        cb('ok')
    else
        TriggerEvent("vorp:TipBottom", _U('InvalidAmount'), 4000)
        cb('invalid')
    end
end)
