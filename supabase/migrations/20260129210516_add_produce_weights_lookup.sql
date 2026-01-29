-- Migration: Add produce_weights lookup table
-- Provides deterministic gram-per-unit values for common fruits, vegetables, and legumes
-- Used by the 800g challenge produce extraction to avoid LLM estimation for known items
-- Gram values sourced from USDA FoodData Central standard reference portions

-- ============================================
-- 1. Create produce_weights table
-- ============================================

CREATE TABLE produce_weights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('fruit', 'vegetable', 'legume')),
  unit TEXT NOT NULL,
  grams DECIMAL NOT NULL,
  source TEXT DEFAULT 'usda',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_produce_weights_lookup
  ON produce_weights(name_normalized, unit);
CREATE INDEX idx_produce_weights_name
  ON produce_weights(name_normalized);

-- RLS - produce_weights are global/shared reference data
ALTER TABLE produce_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view produce_weights"
  ON produce_weights FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage produce_weights"
  ON produce_weights FOR ALL
  USING (true);

GRANT ALL ON produce_weights TO postgres, service_role;
GRANT SELECT ON produce_weights TO authenticated;

-- ============================================
-- 2. Seed produce weight data
-- ============================================

INSERT INTO produce_weights (name, name_normalized, category, unit, grams) VALUES

-- =====================
-- VEGETABLES
-- =====================

-- Broccoli
('Broccoli', 'broccoli', 'vegetable', 'cup_chopped', 91),
('Broccoli', 'broccoli', 'vegetable', 'cup_cooked', 156),
('Broccoli', 'broccoli', 'vegetable', 'medium_stalk', 148),

-- Spinach
('Spinach', 'spinach', 'vegetable', 'cup_raw', 30),
('Spinach', 'spinach', 'vegetable', 'cup_cooked', 180),
('Spinach', 'spinach', 'vegetable', 'oz', 28),

-- Kale
('Kale', 'kale', 'vegetable', 'cup_raw', 20),
('Kale', 'kale', 'vegetable', 'cup_chopped', 67),
('Kale', 'kale', 'vegetable', 'cup_cooked', 130),

-- Bell Pepper
('Bell Pepper', 'bell pepper', 'vegetable', 'medium', 119),
('Bell Pepper', 'bell pepper', 'vegetable', 'large', 150),
('Bell Pepper', 'bell pepper', 'vegetable', 'cup_chopped', 120),
('Bell Pepper', 'bell pepper', 'vegetable', 'cup_sliced', 70),

-- Bell Peppers (plural variant)
('Bell Peppers', 'bell peppers', 'vegetable', 'medium', 119),
('Bell Peppers', 'bell peppers', 'vegetable', 'large', 150),
('Bell Peppers', 'bell peppers', 'vegetable', 'cup_chopped', 120),
('Bell Peppers', 'bell peppers', 'vegetable', 'cup_sliced', 70),

-- Zucchini
('Zucchini', 'zucchini', 'vegetable', 'medium', 196),
('Zucchini', 'zucchini', 'vegetable', 'small', 130),
('Zucchini', 'zucchini', 'vegetable', 'cup_chopped', 124),
('Zucchini', 'zucchini', 'vegetable', 'cup_sliced', 113),
('Zucchini', 'zucchini', 'vegetable', 'cup_cooked', 180),

-- Asparagus
('Asparagus', 'asparagus', 'vegetable', 'cup_cooked', 180),
('Asparagus', 'asparagus', 'vegetable', 'spear', 16),
('Asparagus', 'asparagus', 'vegetable', 'bunch', 340),

-- Green Beans
('Green Beans', 'green beans', 'vegetable', 'cup_raw', 110),
('Green Beans', 'green beans', 'vegetable', 'cup_cooked', 125),

-- Carrots
('Carrots', 'carrots', 'vegetable', 'medium', 61),
('Carrots', 'carrots', 'vegetable', 'large', 72),
('Carrots', 'carrots', 'vegetable', 'cup_chopped', 128),
('Carrots', 'carrots', 'vegetable', 'cup_sliced', 122),
('Carrot', 'carrot', 'vegetable', 'medium', 61),
('Carrot', 'carrot', 'vegetable', 'large', 72),

-- Cauliflower
('Cauliflower', 'cauliflower', 'vegetable', 'cup_chopped', 107),
('Cauliflower', 'cauliflower', 'vegetable', 'cup_cooked', 124),
('Cauliflower', 'cauliflower', 'vegetable', 'medium_head', 588),

-- Brussels Sprouts
('Brussels Sprouts', 'brussels sprouts', 'vegetable', 'cup_raw', 88),
('Brussels Sprouts', 'brussels sprouts', 'vegetable', 'cup_cooked', 156),
('Brussels Sprouts', 'brussels sprouts', 'vegetable', 'sprout', 19),

-- Tomato
('Tomato', 'tomato', 'vegetable', 'medium', 123),
('Tomato', 'tomato', 'vegetable', 'large', 182),
('Tomato', 'tomato', 'vegetable', 'small', 91),
('Tomato', 'tomato', 'vegetable', 'cup_chopped', 180),
('Tomatoes', 'tomatoes', 'vegetable', 'medium', 123),
('Tomatoes', 'tomatoes', 'vegetable', 'cup_chopped', 180),

-- Cherry Tomatoes
('Cherry Tomatoes', 'cherry tomatoes', 'vegetable', 'cup', 149),
('Cherry Tomatoes', 'cherry tomatoes', 'vegetable', 'tomato', 17),

-- Cucumber
('Cucumber', 'cucumber', 'vegetable', 'medium', 201),
('Cucumber', 'cucumber', 'vegetable', 'cup_sliced', 119),
('Cucumber', 'cucumber', 'vegetable', 'cup_chopped', 133),

-- Onion
('Onion', 'onion', 'vegetable', 'medium', 110),
('Onion', 'onion', 'vegetable', 'large', 150),
('Onion', 'onion', 'vegetable', 'small', 70),
('Onion', 'onion', 'vegetable', 'cup_chopped', 160),
('Onion', 'onion', 'vegetable', 'cup_diced', 160),

-- Garlic
('Garlic', 'garlic', 'vegetable', 'clove', 3),
('Garlic', 'garlic', 'vegetable', 'head', 40),

-- Mushrooms
('Mushrooms', 'mushrooms', 'vegetable', 'cup_sliced', 70),
('Mushrooms', 'mushrooms', 'vegetable', 'cup_chopped', 93),
('Mushrooms', 'mushrooms', 'vegetable', 'cup_cooked', 156),

-- Sweet Potato
('Sweet Potato', 'sweet potato', 'vegetable', 'medium', 114),
('Sweet Potato', 'sweet potato', 'vegetable', 'large', 180),
('Sweet Potato', 'sweet potato', 'vegetable', 'cup_cubed', 133),
('Sweet Potato', 'sweet potato', 'vegetable', 'cup_cooked', 200),
('Sweet Potatoes', 'sweet potatoes', 'vegetable', 'medium', 114),

-- Potato (Russet)
('Potato', 'potato', 'vegetable', 'medium', 213),
('Potato', 'potato', 'vegetable', 'large', 299),
('Potato', 'potato', 'vegetable', 'small', 170),
('Russet Potato', 'russet potato', 'vegetable', 'medium', 213),
('Russet Potato', 'russet potato', 'vegetable', 'large', 299),

-- Red Potato
('Red Potato', 'red potato', 'vegetable', 'medium', 170),
('Red Potato', 'red potato', 'vegetable', 'small', 113),

-- Cabbage
('Cabbage', 'cabbage', 'vegetable', 'cup_shredded', 89),
('Cabbage', 'cabbage', 'vegetable', 'cup_chopped', 89),
('Cabbage', 'cabbage', 'vegetable', 'cup_cooked', 150),

-- Celery
('Celery', 'celery', 'vegetable', 'stalk', 40),
('Celery', 'celery', 'vegetable', 'cup_chopped', 101),

-- Corn
('Corn', 'corn', 'vegetable', 'ear', 90),
('Corn', 'corn', 'vegetable', 'cup', 154),
('Corn', 'corn', 'vegetable', 'cup_cooked', 164),

-- Eggplant
('Eggplant', 'eggplant', 'vegetable', 'medium', 458),
('Eggplant', 'eggplant', 'vegetable', 'cup_cubed', 82),
('Eggplant', 'eggplant', 'vegetable', 'cup_cooked', 99),

-- Lettuce (Romaine)
('Romaine Lettuce', 'romaine lettuce', 'vegetable', 'cup_shredded', 47),
('Romaine Lettuce', 'romaine lettuce', 'vegetable', 'leaf', 24),
('Lettuce', 'lettuce', 'vegetable', 'cup_shredded', 47),

-- Arugula
('Arugula', 'arugula', 'vegetable', 'cup', 20),

-- Bok Choy
('Bok Choy', 'bok choy', 'vegetable', 'cup_shredded', 70),
('Bok Choy', 'bok choy', 'vegetable', 'cup_cooked', 170),
('Bok Choy', 'bok choy', 'vegetable', 'head', 300),

-- Butternut Squash
('Butternut Squash', 'butternut squash', 'vegetable', 'cup_cubed', 140),
('Butternut Squash', 'butternut squash', 'vegetable', 'cup_cooked', 205),

-- Spaghetti Squash
('Spaghetti Squash', 'spaghetti squash', 'vegetable', 'cup_cooked', 155),

-- Artichoke
('Artichoke', 'artichoke', 'vegetable', 'medium', 128),

-- Beets
('Beets', 'beets', 'vegetable', 'medium', 82),
('Beets', 'beets', 'vegetable', 'cup_sliced', 136),
('Beets', 'beets', 'vegetable', 'cup_cooked', 170),

-- Radishes
('Radishes', 'radishes', 'vegetable', 'cup_sliced', 116),
('Radishes', 'radishes', 'vegetable', 'radish', 9),

-- Turnips
('Turnips', 'turnips', 'vegetable', 'medium', 122),
('Turnips', 'turnips', 'vegetable', 'cup_cubed', 130),

-- Snap Peas
('Snap Peas', 'snap peas', 'vegetable', 'cup', 63),
('Sugar Snap Peas', 'sugar snap peas', 'vegetable', 'cup', 63),

-- Snow Peas
('Snow Peas', 'snow peas', 'vegetable', 'cup', 63),

-- Jalapeño
('Jalapeño', 'jalapeño', 'vegetable', 'pepper', 14),
('Jalapeno', 'jalapeno', 'vegetable', 'pepper', 14),

-- Poblano Pepper
('Poblano Pepper', 'poblano pepper', 'vegetable', 'pepper', 52),

-- Mixed Greens / Salad Greens
('Mixed Greens', 'mixed greens', 'vegetable', 'cup', 30),
('Salad Greens', 'salad greens', 'vegetable', 'cup', 30),

-- Red Onion
('Red Onion', 'red onion', 'vegetable', 'medium', 110),
('Red Onion', 'red onion', 'vegetable', 'cup_sliced', 115),

-- Yellow Squash
('Yellow Squash', 'yellow squash', 'vegetable', 'medium', 196),
('Yellow Squash', 'yellow squash', 'vegetable', 'cup_sliced', 113),

-- =====================
-- FRUITS
-- =====================

-- Apple
('Apple', 'apple', 'fruit', 'medium', 182),
('Apple', 'apple', 'fruit', 'large', 223),
('Apple', 'apple', 'fruit', 'small', 149),
('Apple', 'apple', 'fruit', 'cup_sliced', 109),

-- Banana
('Banana', 'banana', 'fruit', 'medium', 118),
('Banana', 'banana', 'fruit', 'large', 136),
('Banana', 'banana', 'fruit', 'small', 101),

-- Blueberries
('Blueberries', 'blueberries', 'fruit', 'cup', 148),
('Blueberries', 'blueberries', 'fruit', 'oz', 28),

-- Strawberries
('Strawberries', 'strawberries', 'fruit', 'cup_whole', 144),
('Strawberries', 'strawberries', 'fruit', 'cup_sliced', 166),
('Strawberries', 'strawberries', 'fruit', 'strawberry', 12),

-- Raspberries
('Raspberries', 'raspberries', 'fruit', 'cup', 123),

-- Blackberries
('Blackberries', 'blackberries', 'fruit', 'cup', 144),

-- Mixed Berries
('Mixed Berries', 'mixed berries', 'fruit', 'cup', 150),

-- Orange
('Orange', 'orange', 'fruit', 'medium', 131),
('Orange', 'orange', 'fruit', 'large', 184),
('Orange', 'orange', 'fruit', 'small', 96),

-- Grapes
('Grapes', 'grapes', 'fruit', 'cup', 151),

-- Avocado
('Avocado', 'avocado', 'fruit', 'medium', 150),
('Avocado', 'avocado', 'fruit', 'half', 75),
('Avocado', 'avocado', 'fruit', 'cup_sliced', 146),

-- Mango
('Mango', 'mango', 'fruit', 'medium', 207),
('Mango', 'mango', 'fruit', 'cup_chopped', 165),

-- Pineapple
('Pineapple', 'pineapple', 'fruit', 'cup_chunks', 165),
('Pineapple', 'pineapple', 'fruit', 'slice', 84),

-- Watermelon
('Watermelon', 'watermelon', 'fruit', 'cup_diced', 152),
('Watermelon', 'watermelon', 'fruit', 'wedge', 286),

-- Cantaloupe
('Cantaloupe', 'cantaloupe', 'fruit', 'cup_diced', 156),

-- Peach
('Peach', 'peach', 'fruit', 'medium', 150),
('Peach', 'peach', 'fruit', 'large', 175),
('Peach', 'peach', 'fruit', 'cup_sliced', 154),
('Peaches', 'peaches', 'fruit', 'medium', 150),

-- Pear
('Pear', 'pear', 'fruit', 'medium', 178),
('Pear', 'pear', 'fruit', 'large', 230),

-- Kiwi
('Kiwi', 'kiwi', 'fruit', 'medium', 69),
('Kiwi', 'kiwi', 'fruit', 'large', 91),

-- Cherries
('Cherries', 'cherries', 'fruit', 'cup', 138),

-- Lemon
('Lemon', 'lemon', 'fruit', 'medium', 58),
('Lemon', 'lemon', 'fruit', 'juice', 15),

-- Lime
('Lime', 'lime', 'fruit', 'medium', 44),
('Lime', 'lime', 'fruit', 'juice', 11),

-- =====================
-- LEGUMES
-- =====================

-- Black Beans
('Black Beans', 'black beans', 'legume', 'cup_cooked', 172),
('Black Beans', 'black beans', 'legume', 'cup_canned', 240),
('Black Beans', 'black beans', 'legume', 'half_cup', 86),

-- Chickpeas
('Chickpeas', 'chickpeas', 'legume', 'cup_cooked', 164),
('Chickpeas', 'chickpeas', 'legume', 'cup_canned', 240),
('Chickpeas', 'chickpeas', 'legume', 'half_cup', 82),

-- Lentils
('Lentils', 'lentils', 'legume', 'cup_cooked', 198),
('Lentils', 'lentils', 'legume', 'half_cup', 99),

-- Kidney Beans
('Kidney Beans', 'kidney beans', 'legume', 'cup_cooked', 177),
('Kidney Beans', 'kidney beans', 'legume', 'cup_canned', 256),

-- Edamame
('Edamame', 'edamame', 'legume', 'cup_shelled', 155),
('Edamame', 'edamame', 'legume', 'cup', 155),

-- Peas (Green)
('Peas', 'peas', 'legume', 'cup', 145),
('Peas', 'peas', 'legume', 'cup_cooked', 160),
('Green Peas', 'green peas', 'legume', 'cup', 145),

-- Pinto Beans
('Pinto Beans', 'pinto beans', 'legume', 'cup_cooked', 171),

-- White Beans
('White Beans', 'white beans', 'legume', 'cup_cooked', 179),
('Cannellini Beans', 'cannellini beans', 'legume', 'cup_cooked', 179),

-- Lima Beans
('Lima Beans', 'lima beans', 'legume', 'cup_cooked', 170),

-- Split Peas
('Split Peas', 'split peas', 'legume', 'cup_cooked', 196);
