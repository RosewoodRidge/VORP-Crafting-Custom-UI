local Core = exports.vorp_core:GetCore()

CreateThread(function()
    local item = Config.CampFireItem
    exports.vorp_inventory:registerUsableItem(item, function(data)
        exports.vorp_inventory:subItemById(data.source, data.item.id)
        TriggerClientEvent("vorp:campfire", data.source)
    end)
end)

Core.Callback.Register("vorp_crafting:GetJob", function(source, cb)
    local Character = Core.getUser(source).getUsedCharacter
    local job = Character.job
    cb(job)
end)

RegisterNetEvent('vorp:openInv', function()
    local _source = source
    exports.vorp_inventory:openInventory(_source)
end)

RegisterNetEvent('vorp:startcrafting', function(craftable, countz)
    local _source = source
    local Character = Core.getUser(_source).getUsedCharacter

    local function getServerCraftable()
        local crafting = nil
        for _, v in ipairs(Config.Crafting) do
            if v.Text == craftable.Text then
                crafting = v
                break
            end
        end

        return crafting
    end

    local crafting = getServerCraftable()

    if not crafting then
        return
    end

    local playerjob = Character.job
    local job = crafting.Job
    local craft = false

    if job == 0 then
        craft = true
    end

    if job ~= 0 then
        for _, v in pairs(job) do
            if v == playerjob then
                craft = true
            end
        end
    end

    if not craft then
        Core.NotifyObjective(_source, _U('NotJob'), 5000)
        return
    end

    if not crafting then
        return
    end

    local reward = crafting.Reward
    local itemsToRemove = {}
    local requiredItems = {}


    for _, item in ipairs(crafting.Items) do
        requiredItems[item.name] = {
            required = item.count * countz,
            found = 0,
            canUseDecay = item.canUseDecay,
            take = item.take
        }
    end

    local inventory = exports.vorp_inventory:getUserInventoryItems(source)
    if not inventory then return end

    for _, value in pairs(inventory) do
        local reqItem = requiredItems[value.name]
        if reqItem then
            if reqItem.canUseDecay then
                if value.isDegradable then
                    if value.percentage >= reqItem.canUseDecay then
                        reqItem.found = reqItem.found + value.count
                        if reqItem.take == nil or reqItem.take == true then
                            table.insert(itemsToRemove, { data = value, count = math.min(value.count, reqItem.required) })
                        end
                    end
                else
                    reqItem.found = reqItem.found + value.count
                    if reqItem.take == nil or reqItem.take == true then
                        table.insert(itemsToRemove, { data = value, count = math.min(value.count, reqItem.required) })
                    end
                end
            else
                reqItem.found = reqItem.found + value.count
                if reqItem.take == nil or reqItem.take == true then
                    table.insert(itemsToRemove, { data = value, count = math.min(value.count, reqItem.required) })
                end
            end
        end
    end


    local craftcheck = true
    for itemName, data in pairs(requiredItems) do
        if data.found < data.required then
            craftcheck = false
            break
        end
    end

    if not craftcheck then
        return Core.NotifyObjective(_source, _U('NotEnough'), 5000)
    end

    -- Differentiate between items and weapons
    if crafting.Type == "weapon" then
        local ammo = { ["nothing"] = 0 }
        local components = {}

        for index, v in ipairs(reward) do
            local canCarry = exports.vorp_inventory:canCarryWeapons(_source, v.count * countz, nil, v.name)
            if not canCarry then
                return Core.NotifyObjective(_source, _U('WeaponsFull'), 5000)
            end
        end

        if #itemsToRemove > 0 then
            for _, value in ipairs(itemsToRemove) do
                exports.vorp_inventory:subItemById(_source, value.data.id, nil, nil, value.count)
            end
        end

        for _ = 1, countz do
            for _, v in ipairs(reward) do
                for _ = 1, v.count do
                    exports.vorp_inventory:createWeapon(_source, v.name, ammo, components)
                    Core.AddWebhook(GetPlayerName(_source), Config.Webhook, _U('WebhookWeapon') .. ' ' .. v.name)
                end
            end
        end

        TriggerClientEvent("vorp:crafting", _source, crafting.Animation)
    elseif crafting.Type == "item" then
        local addcount = 0
        local cancarry = false

        if not crafting.UseCurrencyMode then
            for _, rwd in ipairs(reward) do
                local counta = rwd.count * countz
                addcount     = addcount + counta
                cancarry     = exports.vorp_inventory:canCarryItem(_source, rwd.name, counta)
            end
        end

        if crafting.UseCurrencyMode or cancarry then
            if #itemsToRemove > 0 then
                for _, value in ipairs(itemsToRemove) do
                    exports.vorp_inventory:subItemById(_source, value.data.id, nil, nil, value.count)
                end
            end

            for _, v in ipairs(crafting.Reward) do
                local countx = v.count * countz
                if crafting.UseCurrencyMode ~= nil and crafting.CurrencyType ~= nil and crafting.UseCurrencyMode then
                    Character.addCurrency(crafting.CurrencyType, countx)
                else
                    exports.vorp_inventory:addItem(_source, v.name, countx)
                    Core.AddWebhook(GetPlayerName(_source), Config.Webhook, _U('WebhookItem') .. ' x' .. countx .. ' ' .. v.name)
                end
            end

            TriggerClientEvent("vorp:crafting", _source, crafting.Animation)
        else
            TriggerClientEvent("vorp:TipRight", _source, _U('TooFull'), 3000)
        end
    end

    -- After successful crafting, trigger inventory update
    TriggerEvent('vorp-craft:craftingCompleted')
end)

-- Helper function to get real item labels from vorp_inventory database
local function GetItemLabelFromDB(itemName)
    -- Use the server-side export which works properly
    local itemData = exports.vorp_inventory:getItemDB(itemName)
    if itemData and itemData.label then
        return itemData.label
    end
    return itemName -- Fallback to item name if no label found
end

-- Function to collect all item labels and limits for a client
local function CollectItemLabels(craftables)
    local itemLabels = {}
    local itemLimits = {} -- Add new table for limits
    
    -- Process all craftables to collect unique item names
    for _, craftable in pairs(craftables) do
        -- Process ingredients
        if craftable.Items then
            for _, item in pairs(craftable.Items) do
                if item.name and itemLabels[item.name] == nil then
                    local itemData = exports.vorp_inventory:getItemDB(item.name)
                    if itemData then
                        itemLabels[item.name] = itemData.label
                        -- Store the item limit
                        itemLimits[item.name] = itemData.limit
                    else
                        itemLabels[item.name] = item.name
                        itemLimits[item.name] = 0 -- Default limit if item not found
                    end
                end
            end
        end
        
        -- Process rewards
        if craftable.Reward then
            for _, reward in pairs(craftable.Reward) do
                if reward.name and itemLabels[reward.name] == nil then
                    local itemData = exports.vorp_inventory:getItemDB(reward.name)
                    if itemData then
                        itemLabels[reward.name] = itemData.label
                        -- Store the item limit
                        itemLimits[reward.name] = itemData.limit
                    else
                        itemLabels[reward.name] = reward.name
                        itemLimits[reward.name] = 0 -- Default limit if item not found
                    end
                end
            end
        end
    end
    
    return itemLabels, itemLimits
end

-- New callback to get item labels and limits
Core.Callback.Register("vorp_crafting:GetAllItemLabels", function(source, cb)
    local itemLabels, itemLimits = CollectItemLabels(Config.Crafting)
    cb({labels = itemLabels, limits = itemLimits})
end)

-- New callback to get player inventory
Core.Callback.Register("vorp_crafting:GetPlayerInventory", function(source, cb)
    local inventory = exports.vorp_inventory:getUserInventoryItems(source)
    cb(inventory)
end)

local VorpCore = {}

TriggerEvent("getCore", function(core)
    VorpCore = core
end)

-- Function to get player's current inventory
local function GetPlayerInventory(source)
    local User = VorpCore.getUser(source)
    if not User then return {} end
    
    local Character = User.getUsedCharacter
    if not Character then return {} end
    
    local inventory = {}
    -- Get player's inventory items
    -- This will depend on your inventory system implementation
    -- Example for VORP inventory:
    exports.vorp_inventory:getUserInventory(source, function(data)
        if data then
            for _, item in pairs(data) do
                inventory[item.name] = item.count or 0
            end
        end
    end)
    
    return inventory
end

-- Function to send updated inventory to client
local function SendInventoryUpdate(source)
    local inventory = GetPlayerInventory(source)
    TriggerClientEvent('vorp-craft:updateInventory', source, inventory)
end

-- Register callback for when crafting is completed
RegisterServerEvent('vorp-craft:craftingCompleted')
AddEventHandler('vorp-craft:craftingCompleted', function()
    local source = source
    -- Send updated inventory after a short delay to ensure all transactions are complete
    Citizen.SetTimeout(100, function()
        SendInventoryUpdate(source)
    end)
end)
