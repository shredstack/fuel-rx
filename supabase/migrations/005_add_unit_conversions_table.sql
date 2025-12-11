-- Unit conversions table for converting ingredient amounts to grams
-- This allows easy modification without code deployments

-- Density multipliers for volume-to-gram conversions
-- Multiplied with base volume conversion (e.g., 1 cup = 240ml * density = grams)
CREATE TABLE density_multipliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ingredient_name TEXT UNIQUE NOT NULL,
    multiplier DECIMAL NOT NULL,
    category TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Standard item weights for countable items (eggs, fruits, etc.)
CREATE TABLE item_weights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ingredient_name TEXT UNIQUE NOT NULL,
    weight_grams DECIMAL NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX idx_density_multipliers_name ON density_multipliers(ingredient_name);
CREATE INDEX idx_item_weights_name ON item_weights(ingredient_name);

-- Triggers to update updated_at
CREATE TRIGGER update_density_multipliers_updated_at
    BEFORE UPDATE ON density_multipliers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_item_weights_updated_at
    BEFORE UPDATE ON item_weights
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed density multipliers with initial data
INSERT INTO density_multipliers (ingredient_name, multiplier, category) VALUES
    -- Liquids (baseline density ~1)
    ('water', 1, 'liquid'),
    ('milk', 1.03, 'liquid'),
    ('olive oil', 0.92, 'liquid'),
    ('oil', 0.92, 'liquid'),
    ('honey', 1.42, 'liquid'),
    ('maple syrup', 1.37, 'liquid'),

    -- Flour and powders (less dense)
    ('flour', 0.53, 'powder'),
    ('almond flour', 0.48, 'powder'),
    ('coconut flour', 0.45, 'powder'),
    ('protein powder', 0.4, 'powder'),
    ('cocoa powder', 0.45, 'powder'),
    ('sugar', 0.85, 'powder'),
    ('brown sugar', 0.83, 'powder'),

    -- Grains, cereals, and rice
    ('rice', 0.75, 'grain'),
    ('oats', 0.35, 'grain'),
    ('rolled oats', 0.35, 'grain'),
    ('quinoa', 0.73, 'grain'),
    ('granola', 0.45, 'grain'),
    ('cereal', 0.4, 'grain'),
    ('muesli', 0.45, 'grain'),

    -- Vegetables (leafy are less dense)
    ('spinach', 0.25, 'vegetable'),
    ('lettuce', 0.2, 'vegetable'),
    ('kale', 0.25, 'vegetable'),
    ('mixed greens', 0.22, 'vegetable'),

    -- Fruits and berries
    ('berries', 0.6, 'fruit'),
    ('blueberries', 0.65, 'fruit'),
    ('strawberries', 0.55, 'fruit'),
    ('raspberries', 0.5, 'fruit'),
    ('blackberries', 0.55, 'fruit'),
    ('mixed berries', 0.6, 'fruit'),

    -- Nuts and seeds
    ('almonds', 0.6, 'nuts'),
    ('walnuts', 0.55, 'nuts'),
    ('peanut butter', 1.05, 'nuts'),
    ('almond butter', 1.05, 'nuts'),

    -- Dairy
    ('greek yogurt', 1.05, 'dairy'),
    ('yogurt', 1.03, 'dairy'),
    ('cottage cheese', 0.95, 'dairy'),
    ('cheese', 0.9, 'dairy'),
    ('butter', 0.91, 'dairy');

-- Seed item weights with initial data
INSERT INTO item_weights (ingredient_name, weight_grams, notes) VALUES
    ('egg', 50, 'large egg'),
    ('eggs', 50, 'large egg, per unit'),
    ('large egg', 50, NULL),
    ('large eggs', 50, 'per unit'),
    ('banana', 118, 'medium banana'),
    ('bananas', 118, 'per unit'),
    ('apple', 182, 'medium apple'),
    ('apples', 182, 'per unit'),
    ('orange', 131, 'medium orange'),
    ('oranges', 131, 'per unit'),
    ('avocado', 150, 'medium avocado, flesh only'),
    ('avocados', 150, 'per unit'),
    ('chicken breast', 174, 'boneless skinless'),
    ('chicken breasts', 174, 'per unit'),
    ('salmon fillet', 170, 'standard fillet'),
    ('salmon fillets', 170, 'per unit'),
    ('sweet potato', 130, 'medium'),
    ('sweet potatoes', 130, 'per unit'),
    ('potato', 150, 'medium'),
    ('potatoes', 150, 'per unit'),
    ('tomato', 123, 'medium'),
    ('tomatoes', 123, 'per unit'),
    ('onion', 110, 'medium'),
    ('onions', 110, 'per unit'),
    ('garlic', 3, 'single clove'),
    ('garlic clove', 3, NULL),
    ('garlic cloves', 3, 'per clove'),
    ('clove', 3, 'garlic clove'),
    ('cloves', 3, 'per clove'),
    ('lemon', 58, 'medium'),
    ('lemons', 58, 'per unit'),
    ('lime', 44, 'medium'),
    ('limes', 44, 'per unit'),
    ('slice', 30, 'generic slice (bread, etc)'),
    ('slices', 30, 'per slice'),
    ('piece', 100, 'generic piece'),
    ('pieces', 100, 'per piece');
