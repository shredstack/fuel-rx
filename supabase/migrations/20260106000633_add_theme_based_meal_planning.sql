-- Migration: Add Theme-Based Meal Planning
-- ============================================
-- 1. Create meal_plan_themes table
-- ============================================

CREATE TABLE meal_plan_themes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Basic info
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  emoji TEXT, -- For fun display, e.g., "🌊" for Mediterranean

  -- Theme guidance for LLM
  ingredient_guidance JSONB NOT NULL,
  -- Structure:
  -- {
  --   "proteins": ["salmon", "chicken thighs", "shrimp", "lamb"],
  --   "vegetables": ["tomatoes", "cucumbers", "bell peppers", "zucchini", "eggplant"],
  --   "fruits": ["lemons", "olives", "figs"],
  --   "grains": ["quinoa", "couscous", "pita bread", "farro"],
  --   "fats": ["olive oil", "feta cheese", "tahini"],
  --   "seasonings": ["oregano", "basil", "garlic", "cumin", "za'atar"],
  --   "flavor_profile": "bright, herby, citrus-forward, olive oil-based"
  -- }

  cooking_style_guidance TEXT NOT NULL,
  -- e.g., "Focus on grilling, roasting, and fresh preparations.
  --        Emphasize simple techniques that let ingredients shine.
  --        Common methods: sheet pan roasting, quick sautés, fresh salads."

  meal_name_style TEXT,
  -- e.g., "Use Mediterranean-inspired names: 'Greek Chicken Bowl',
  --        'Lemon Herb Salmon', 'Mediterranean Veggie Wrap'"

  -- Dietary restriction compatibility
  -- Themes incompatible with certain diets should be filtered out
  compatible_diets TEXT[] DEFAULT ARRAY['no_restrictions'],
  -- Options: 'no_restrictions', 'paleo', 'vegetarian', 'vegan', 'gluten_free', 'dairy_free'
  -- NULL or empty means compatible with all

  incompatible_diets TEXT[] DEFAULT ARRAY[]::TEXT[],
  -- Explicit incompatibilities, e.g., dairy-heavy theme incompatible with 'dairy_free'

  -- Seasonal appropriateness (1-12 for months, empty = year-round)
  peak_seasons INT[] DEFAULT ARRAY[]::INT[],
  -- e.g., [6,7,8] for summer themes, [11,12,1,2] for winter comfort food

  -- Metadata
  is_system_theme BOOLEAN DEFAULT TRUE, -- FALSE for future community themes
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_meal_plan_themes_name ON meal_plan_themes(name);
CREATE INDEX idx_meal_plan_themes_active ON meal_plan_themes(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_meal_plan_themes_system ON meal_plan_themes(is_system_theme);

-- Enable RLS (themes are readable by all authenticated users)
ALTER TABLE meal_plan_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active themes"
  ON meal_plan_themes FOR SELECT
  USING (is_active = TRUE);

-- Only service role can modify system themes
CREATE POLICY "Service role can manage themes"
  ON meal_plan_themes FOR ALL
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON meal_plan_themes TO authenticated;
GRANT ALL ON meal_plan_themes TO postgres, service_role;

-- ============================================
-- 2. Create user_theme_preferences table
-- ============================================

CREATE TABLE user_theme_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_id UUID NOT NULL REFERENCES meal_plan_themes(id) ON DELETE CASCADE,

  -- Preference type
  preference TEXT NOT NULL CHECK (preference IN ('preferred', 'blocked')),
  -- 'preferred': Increase likelihood of selection
  -- 'blocked': Never auto-select this theme

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Each user can only have one preference per theme
  UNIQUE(user_id, theme_id)
);

-- Indexes
CREATE INDEX idx_user_theme_preferences_user_id ON user_theme_preferences(user_id);
CREATE INDEX idx_user_theme_preferences_preference ON user_theme_preferences(user_id, preference);

-- Enable RLS
ALTER TABLE user_theme_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own theme preferences"
  ON user_theme_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own theme preferences"
  ON user_theme_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own theme preferences"
  ON user_theme_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own theme preferences"
  ON user_theme_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON user_theme_preferences TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_theme_preferences TO authenticated;

-- ============================================
-- 3. Add theme_id to meal_plans table
-- ============================================

ALTER TABLE meal_plans
ADD COLUMN theme_id UUID REFERENCES meal_plan_themes(id) ON DELETE SET NULL;

-- Index for querying recent themes
CREATE INDEX idx_meal_plans_theme_id ON meal_plans(theme_id);
CREATE INDEX idx_meal_plans_user_theme_recent ON meal_plans(user_id, created_at DESC, theme_id);

-- Comment for documentation
COMMENT ON COLUMN meal_plans.theme_id IS 'Reference to the theme used for this meal plan';

-- ============================================
-- 4. Seed initial themes
-- ============================================

INSERT INTO meal_plan_themes (name, display_name, description, emoji, ingredient_guidance, cooking_style_guidance, meal_name_style, compatible_diets, incompatible_diets, peak_seasons) VALUES

-- Mediterranean
('mediterranean', 'Mediterranean', 'Sun-kissed flavors from the Greek isles and coastal Italy. Fresh herbs, olive oil, and bright citrus.', '🫒',
'{
  "proteins": ["salmon", "chicken thighs", "shrimp", "lamb", "white fish", "chickpeas"],
  "vegetables": ["tomatoes", "cucumbers", "bell peppers", "zucchini", "eggplant", "spinach", "artichokes", "red onion"],
  "fruits": ["lemons", "olives", "figs", "grapes"],
  "grains": ["quinoa", "couscous", "pita bread", "farro", "bulgur"],
  "fats": ["olive oil", "feta cheese", "tahini", "hummus", "greek yogurt"],
  "seasonings": ["oregano", "basil", "garlic", "cumin", "za''atar", "sumac", "dill", "mint"],
  "flavor_profile": "bright, herby, citrus-forward, olive oil-based, tangy from feta and lemon"
}',
'Focus on grilling, roasting, and fresh preparations. Emphasize simple techniques that let quality ingredients shine. Common methods: sheet pan roasting, quick sautés, fresh grain bowls, and composed salads with bold dressings.',
'Use Mediterranean-inspired names that evoke the region: "Greek Chicken Power Bowl", "Lemon Herb Salmon", "Mediterranean Mezze Plate", "Tuscan White Bean Salad"',
ARRAY['no_restrictions', 'gluten_free'],
ARRAY['dairy_free'],
ARRAY[4,5,6,7,8,9]),

-- Asian Fusion
('asian_fusion', 'Asian Fusion', 'Bold umami flavors from across Asia. Soy, ginger, sesame, and aromatic spices.', '🥢',
'{
  "proteins": ["chicken breast", "beef sirloin", "salmon", "shrimp", "tofu", "pork tenderloin", "eggs"],
  "vegetables": ["bok choy", "broccoli", "snap peas", "bell peppers", "carrots", "edamame", "mushrooms", "cabbage", "green onions"],
  "fruits": ["oranges", "pineapple", "mango", "lime"],
  "grains": ["jasmine rice", "brown rice", "rice noodles", "soba noodles"],
  "fats": ["sesame oil", "coconut milk", "peanuts", "cashews"],
  "seasonings": ["soy sauce", "ginger", "garlic", "sriracha", "rice vinegar", "miso", "five spice", "lemongrass", "cilantro", "Thai basil"],
  "flavor_profile": "umami-rich, sweet-savory balance, aromatic, fresh herbs, hint of heat"
}',
'Focus on stir-frying, steaming, and quick high-heat cooking. Prep all ingredients before cooking (mise en place is essential). Common methods: wok stir-fry, rice bowls, noodle dishes, lettuce wraps.',
'Use Asian-inspired names: "Teriyaki Salmon Bowl", "Ginger Beef Stir-Fry", "Thai Peanut Chicken", "Miso Glazed Cod"',
ARRAY['no_restrictions', 'dairy_free'],
ARRAY[]::TEXT[],
ARRAY[]::INT[]),

-- Mexican/Latin
('mexican_latin', 'Mexican & Latin', 'Vibrant, bold flavors from Mexico and Latin America. Cumin, lime, cilantro, and fresh peppers.', '🌮',
'{
  "proteins": ["chicken thighs", "ground beef", "carnitas (pork)", "black beans", "shrimp", "flank steak", "eggs"],
  "vegetables": ["bell peppers", "onions", "tomatoes", "corn", "avocado", "jalapeños", "poblano peppers", "romaine lettuce", "jicama"],
  "fruits": ["lime", "mango", "pineapple", "tomatoes"],
  "grains": ["brown rice", "corn tortillas", "quinoa", "black beans", "pinto beans"],
  "fats": ["avocado", "cotija cheese", "sour cream", "olive oil"],
  "seasonings": ["cumin", "chili powder", "cilantro", "lime juice", "garlic", "oregano", "paprika", "chipotle", "adobo"],
  "flavor_profile": "bold, zesty, smoky-spicy, bright citrus, fresh herbs"
}',
'Focus on building layers of flavor through proper seasoning and fresh toppings. Common methods: sheet pan fajitas, burrito bowls, taco assembly, grilled proteins with fresh salsas.',
'Use Latin-inspired names: "Chipotle Chicken Bowl", "Carnitas Tacos", "Black Bean Fiesta Salad", "Lime Cilantro Shrimp"',
ARRAY['no_restrictions', 'gluten_free'],
ARRAY[]::TEXT[],
ARRAY[5,6,7,8,9]),

-- Summer Fresh
('summer_fresh', 'Summer Fresh', 'Light, refreshing meals perfect for hot days. Grilling, salads, and minimal cooking.', '☀️',
'{
  "proteins": ["grilled chicken", "salmon", "shrimp", "tuna", "turkey burgers", "white fish"],
  "vegetables": ["zucchini", "corn", "tomatoes", "cucumbers", "bell peppers", "arugula", "watermelon", "asparagus", "green beans"],
  "fruits": ["berries", "peaches", "watermelon", "citrus", "avocado"],
  "grains": ["quinoa", "couscous", "whole grain bread"],
  "fats": ["olive oil", "feta cheese", "goat cheese", "almonds"],
  "seasonings": ["fresh basil", "mint", "dill", "lemon zest", "balsamic", "light vinaigrettes"],
  "flavor_profile": "light, bright, refreshing, minimal heavy sauces, emphasis on freshness"
}',
'Focus on grilling, raw preparations, and quick assembly. Minimize time over hot stoves. Common methods: grilled proteins, grain salads, lettuce wraps, no-cook meal prep.',
'Use fresh, summery names: "Grilled Lemon Herb Chicken Salad", "Summer Corn & Shrimp Bowl", "Watermelon Feta Power Salad", "Mediterranean Tuna Wrap"',
ARRAY['no_restrictions', 'gluten_free', 'dairy_free'],
ARRAY[]::TEXT[],
ARRAY[6,7,8]),

-- Comfort Classics
('comfort_classics', 'Comfort Classics', 'Hearty, satisfying meals that feel like home. Familiar flavors, warm preparations.', '🍲',
'{
  "proteins": ["chicken breast", "ground turkey", "beef", "pork chops", "eggs", "rotisserie chicken"],
  "vegetables": ["potatoes", "sweet potatoes", "carrots", "broccoli", "green beans", "spinach", "mushrooms", "onions", "celery"],
  "fruits": ["apples", "dried cranberries"],
  "grains": ["brown rice", "whole wheat pasta", "oats", "whole grain bread", "quinoa"],
  "fats": ["butter", "olive oil", "cheddar cheese", "parmesan"],
  "seasonings": ["garlic", "thyme", "rosemary", "parsley", "paprika", "sage", "black pepper", "bay leaves"],
  "flavor_profile": "savory, warming, familiar, herb-forward, comforting richness"
}',
'Focus on one-pot meals, sheet pan dinners, and slow-cooked flavors (even with quick methods). Common methods: baked dishes, skillet meals, hearty soups, casserole-style preparations.',
'Use comforting, familiar names: "Herb Roasted Chicken & Vegetables", "Turkey Meatball Skillet", "Loaded Sweet Potato Bowl", "One-Pan Garlic Butter Salmon"',
ARRAY['no_restrictions'],
ARRAY['paleo'],
ARRAY[10,11,12,1,2,3]),

-- High-Protein Power
('high_protein_power', 'High-Protein Power', 'Maximum protein for serious athletes. Lean meats, eggs, Greek yogurt, and protein-rich plants.', '💪',
'{
  "proteins": ["chicken breast", "turkey breast", "lean ground beef", "salmon", "tuna", "eggs", "egg whites", "greek yogurt", "cottage cheese", "shrimp"],
  "vegetables": ["spinach", "broccoli", "asparagus", "bell peppers", "kale", "brussels sprouts"],
  "fruits": ["berries", "banana", "apple"],
  "grains": ["quinoa", "oats", "brown rice", "whole grain bread"],
  "fats": ["almonds", "avocado", "olive oil", "natural peanut butter"],
  "seasonings": ["garlic", "lemon", "herbs", "low-sodium soy sauce", "hot sauce", "mustard"],
  "flavor_profile": "clean, simple, protein-forward, minimal added fats, functional fuel"
}',
'Focus on lean cooking methods that preserve protein quality. Prioritize ease of meal prep for post-workout. Common methods: grilling, baking, poaching, meal prep containers.',
'Use powerful, athletic names: "Protein Power Bowl", "Lean Turkey Meatballs", "Greek Yogurt Parfait", "Grilled Chicken & Greens"',
ARRAY['no_restrictions', 'gluten_free', 'dairy_free', 'paleo'],
ARRAY[]::TEXT[],
ARRAY[]::INT[]),

-- Plant-Forward
('plant_forward', 'Plant-Forward', 'Vegetables take center stage with protein supporting. Not vegetarian, but veggie-heavy.', '🥦',
'{
  "proteins": ["chickpeas", "black beans", "lentils", "tofu", "tempeh", "eggs", "chicken breast", "salmon"],
  "vegetables": ["kale", "sweet potatoes", "cauliflower", "broccoli", "zucchini", "bell peppers", "spinach", "brussels sprouts", "mushrooms", "beets", "carrots"],
  "fruits": ["avocado", "lemon", "berries", "tomatoes"],
  "grains": ["quinoa", "farro", "brown rice", "whole grain bread"],
  "fats": ["olive oil", "tahini", "nuts", "seeds", "avocado"],
  "seasonings": ["turmeric", "cumin", "smoked paprika", "nutritional yeast", "garlic", "ginger", "fresh herbs"],
  "flavor_profile": "earthy, colorful, nutrient-dense, varied textures, umami from roasted vegetables"
}',
'Focus on making vegetables the star through proper technique - roasting for caramelization, proper seasoning, varied textures. Common methods: grain bowls, roasted vegetable plates, hearty salads.',
'Use vegetable-forward names: "Roasted Cauliflower Steak with Chimichurri", "Rainbow Buddha Bowl", "Loaded Sweet Potato with Black Beans", "Kale Caesar with Grilled Chicken"',
ARRAY['no_restrictions', 'vegetarian', 'vegan', 'gluten_free', 'dairy_free'],
ARRAY[]::TEXT[],
ARRAY[]::INT[]),

-- Quick & Easy
('quick_easy', 'Quick & Easy', 'Maximum efficiency, minimum fuss. Simple ingredients, fast prep, easy cleanup.', '⚡',
'{
  "proteins": ["rotisserie chicken", "canned tuna", "eggs", "pre-cooked shrimp", "deli turkey", "canned beans", "frozen fish fillets"],
  "vegetables": ["pre-washed greens", "cherry tomatoes", "baby carrots", "pre-cut vegetables", "frozen vegetables", "avocado"],
  "fruits": ["banana", "apples", "berries", "pre-cut fruit"],
  "grains": ["minute rice", "tortillas", "whole grain bread", "instant oats", "pre-cooked quinoa"],
  "fats": ["olive oil", "pre-made hummus", "cheese slices", "nut butter"],
  "seasonings": ["everything bagel seasoning", "Italian seasoning", "pre-made dressings", "salsa", "hot sauce", "lemon juice"],
  "flavor_profile": "simple, accessible, no-fuss, familiar flavors, convenience without sacrifice"
}',
'Focus on assembly over cooking. Use high-quality convenience ingredients. Common methods: wraps, grain bowls, sheet pan meals, microwave-friendly options.',
'Use simple, approachable names: "5-Minute Tuna Salad Wrap", "Sheet Pan Chicken & Veggies", "Hummus Power Bowl", "Rotisserie Chicken Salad"',
ARRAY['no_restrictions', 'gluten_free', 'dairy_free'],
ARRAY[]::TEXT[],
ARRAY[]::INT[]),

-- Middle Eastern
('middle_eastern', 'Middle Eastern', 'Rich spices and bold flavors from the Levant and beyond. Tahini, za''atar, and warming spices.', '🧆',
'{
  "proteins": ["chicken thighs", "lamb", "beef kofta", "chickpeas", "lentils", "eggs", "falafel"],
  "vegetables": ["eggplant", "tomatoes", "cucumbers", "onions", "cauliflower", "zucchini", "spinach", "roasted peppers"],
  "fruits": ["lemon", "pomegranate", "dates", "dried apricots"],
  "grains": ["pita bread", "couscous", "bulgur", "rice", "flatbread"],
  "fats": ["tahini", "olive oil", "feta", "labneh", "pine nuts"],
  "seasonings": ["za''atar", "sumac", "cumin", "coriander", "turmeric", "cinnamon", "allspice", "garlic", "fresh parsley", "mint"],
  "flavor_profile": "warm spices, nutty tahini, bright herbs, smoky grilled meats, tangy yogurt sauces"
}',
'Focus on layering warm spices and fresh herbs. Balance rich tahini-based sauces with bright herbs and pickled vegetables. Common methods: grilled kebabs, mezze plates, grain bowls, stuffed vegetables.',
'Use Middle Eastern-inspired names: "Za''atar Chicken Plate", "Lamb Kofta Bowl", "Falafel Power Salad", "Shawarma-Spiced Cauliflower"',
ARRAY['no_restrictions', 'gluten_free'],
ARRAY['dairy_free'],
ARRAY[]::INT[]),

-- Tropical
('tropical', 'Tropical', 'Bright, island-inspired flavors. Coconut, pineapple, citrus, and fresh seafood.', '🏝️',
'{
  "proteins": ["mahi mahi", "shrimp", "chicken thighs", "pork tenderloin", "tuna", "salmon"],
  "vegetables": ["bell peppers", "red onion", "cabbage", "snap peas", "spinach", "jicama"],
  "fruits": ["pineapple", "mango", "coconut", "lime", "papaya", "banana", "avocado"],
  "grains": ["jasmine rice", "coconut rice", "quinoa"],
  "fats": ["coconut oil", "coconut milk", "macadamia nuts", "avocado"],
  "seasonings": ["lime juice", "cilantro", "ginger", "garlic", "jerk seasoning", "Thai basil", "chili flakes"],
  "flavor_profile": "sweet-tangy, coconut-forward, bright citrus, fresh and vibrant, hint of heat"
}',
'Focus on bright, fresh preparations with tropical fruits as both ingredients and garnishes. Common methods: grilled proteins with fruit salsas, poke-style bowls, coconut-based curries.',
'Use tropical, island-inspired names: "Hawaiian Poke Bowl", "Coconut Lime Shrimp", "Mango Chicken Rice Bowl", "Jerk Salmon with Pineapple Salsa"',
ARRAY['no_restrictions', 'dairy_free', 'gluten_free', 'paleo'],
ARRAY[]::TEXT[],
ARRAY[5,6,7,8,9]),

-- Fall Harvest
('fall_harvest', 'Fall Harvest', 'Cozy autumn flavors. Squash, apples, warm spices, and hearty preparations.', '🍂',
'{
  "proteins": ["pork tenderloin", "chicken thighs", "turkey", "sausage", "salmon", "lentils"],
  "vegetables": ["butternut squash", "sweet potatoes", "brussels sprouts", "kale", "apples", "parsnips", "beets", "onions", "mushrooms"],
  "fruits": ["apples", "pears", "cranberries", "figs"],
  "grains": ["wild rice", "farro", "oats", "whole grain bread", "quinoa"],
  "fats": ["olive oil", "butter", "pecans", "walnuts", "goat cheese"],
  "seasonings": ["sage", "rosemary", "thyme", "cinnamon", "nutmeg", "maple", "apple cider vinegar", "mustard"],
  "flavor_profile": "earthy, slightly sweet, warming spices, savory herbs, caramelized depth"
}',
'Focus on roasting to bring out natural sweetness in fall vegetables. Layer warm, cozy flavors. Common methods: sheet pan roasts, one-pot meals, warm grain salads, apple-based sauces.',
'Use autumnal names: "Maple Sage Pork with Roasted Squash", "Harvest Chicken Sheet Pan", "Apple Cider Turkey Meatballs", "Fall Buddha Bowl"',
ARRAY['no_restrictions', 'gluten_free'],
ARRAY[]::TEXT[],
ARRAY[9,10,11]);

-- Add comment for documentation
COMMENT ON TABLE meal_plan_themes IS 'Meal plan themes for variety and engagement. Themes guide ingredient selection and meal styling.';
