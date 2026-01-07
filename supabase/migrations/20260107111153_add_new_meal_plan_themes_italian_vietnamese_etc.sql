-- Add 8 New Meal Plan Themes to FuelRx
-- ============================================
-- Run this script to add Italian, Vietnamese, Indian-Inspired, BBQ & Grilled,
-- Breakfast Champions, One-Pan Wonders, Seafood Focus, and Tex-Mex themes

INSERT INTO meal_plan_themes (name, display_name, description, emoji, ingredient_guidance, cooking_style_guidance, meal_name_style, compatible_diets, incompatible_diets, peak_seasons) VALUES

-- Italian
('italian', 'Italian', 'Classic Italian flavors. Tomatoes, fresh basil, garlic, and quality olive oil.', '🍝',
'{
  "proteins": ["chicken breast", "ground turkey", "ground beef", "italian sausage", "shrimp", "white fish", "parmesan cheese", "mozzarella", "ricotta"],
  "vegetables": ["tomatoes", "zucchini", "bell peppers", "spinach", "arugula", "eggplant", "mushrooms", "onions", "garlic"],
  "fruits": ["tomatoes", "lemon", "olives"],
  "grains": ["whole wheat pasta", "penne", "spaghetti", "farro", "polenta", "risotto rice", "whole grain bread"],
  "fats": ["olive oil", "parmesan cheese", "mozzarella", "pine nuts"],
  "seasonings": ["fresh basil", "oregano", "garlic", "red pepper flakes", "balsamic vinegar", "Italian seasoning", "parsley", "rosemary", "thyme"],
  "flavor_profile": "tomato-forward, garlicky, herbaceous, olive oil-based, umami from parmesan, bright acidity"
}',
'Focus on simple, quality ingredients with proper seasoning. Build flavor through garlic, herbs, and good olive oil. Common methods: pasta dishes, sheet pan chicken parmesan, Italian sausage with peppers, caprese-style salads, baked ziti.',
'Use Italian-inspired names: "Tuscan Chicken Pasta", "Italian Sausage & Peppers", "Pesto Grilled Chicken", "Margherita Chicken Bake", "Balsamic Glazed Salmon"',
ARRAY['no_restrictions'],
ARRAY['dairy_free', 'gluten_free']::TEXT[],
ARRAY[]::INT[]),

-- Vietnamese
('vietnamese', 'Vietnamese', 'Light, fresh Vietnamese flavors. Fish sauce, lime, fresh herbs, and aromatic balance.', '🥗',
'{
  "proteins": ["chicken breast", "pork tenderloin", "shrimp", "white fish", "ground pork", "tofu", "eggs"],
  "vegetables": ["lettuce", "cucumber", "carrots", "bean sprouts", "bok choy", "cabbage", "snap peas", "bell peppers", "jalapeños"],
  "fruits": ["lime", "mango", "pineapple"],
  "grains": ["rice noodles", "jasmine rice", "vermicelli", "brown rice"],
  "fats": ["peanuts", "cashews", "sesame oil"],
  "seasonings": ["fish sauce", "lime juice", "fresh cilantro", "fresh mint", "fresh basil", "ginger", "garlic", "rice vinegar", "sriracha", "lemongrass", "green onions"],
  "flavor_profile": "bright, fresh, herbaceous, fish sauce umami, lime-forward, balanced sweet-salty-sour-spicy"
}',
'Focus on fresh, light preparations with abundant herbs. Build layers of flavor with fish sauce, lime, and aromatics. Common methods: rice bowls (bun-style), spring rolls, lettuce wraps, quick stir-fries, noodle salads (bun-style).',
'Use Vietnamese-inspired names: "Vietnamese Chicken Rice Bowl", "Lemongrass Pork Vermicelli", "Banh Mi-Style Chicken", "Fresh Spring Roll Bowl", "Caramelized Pork with Rice"',
ARRAY['no_restrictions', 'dairy_free', 'gluten_free'],
ARRAY[]::TEXT[],
ARRAY[5,6,7,8,9]),

-- Indian-Inspired
('indian_inspired', 'Indian-Inspired', 'Warming Indian spices and aromatic curries. Turmeric, cumin, garam masala, and yogurt-based sauces.', '🍛',
'{
  "proteins": ["chicken thighs", "chicken breast", "lamb", "lentils", "chickpeas", "paneer", "eggs", "ground turkey"],
  "vegetables": ["cauliflower", "spinach", "tomatoes", "onions", "peas", "bell peppers", "potatoes", "sweet potatoes", "eggplant"],
  "fruits": ["tomatoes", "mango", "coconut"],
  "grains": ["basmati rice", "brown rice", "naan", "quinoa", "lentils", "chickpeas"],
  "fats": ["ghee", "coconut milk", "yogurt", "cashews", "almonds"],
  "seasonings": ["turmeric", "cumin", "coriander", "garam masala", "curry powder", "ginger", "garlic", "cardamom", "cinnamon", "cayenne", "fresh cilantro", "mint"],
  "flavor_profile": "warm spices, aromatic, creamy yogurt-based sauces, layered complexity, hint of heat"
}',
'Focus on layering warm spices and building complex flavors. Use yogurt or coconut milk for creamy sauces. Common methods: one-pot curries, sheet pan tikka masala, dal (lentil stews), biryani-style rice bowls, spiced cauliflower.',
'Use Indian-inspired names: "Chicken Tikka Masala Bowl", "Curry Spiced Cauliflower", "Tandoori-Style Grilled Chicken", "Lentil Dal Power Bowl", "Coconut Curry Shrimp"',
ARRAY['no_restrictions', 'gluten_free'],
ARRAY[]::TEXT[],
ARRAY[10,11,12,1,2,3]),

-- BBQ & Grilled
('bbq_grilled', 'BBQ & Grilled', 'Smoky, flame-kissed flavors. BBQ sauces, dry rubs, and outdoor cooking vibes.', '🔥',
'{
  "proteins": ["chicken breast", "chicken thighs", "pork tenderloin", "beef steak", "ground beef", "ribs", "brisket", "salmon", "shrimp"],
  "vegetables": ["corn", "bell peppers", "onions", "zucchini", "asparagus", "portobello mushrooms", "sweet potatoes", "coleslaw mix"],
  "fruits": ["pineapple", "peaches", "apples"],
  "grains": ["baked beans", "cornbread", "brown rice", "quinoa", "sweet potato"],
  "fats": ["olive oil", "butter", "cheddar cheese"],
  "seasonings": ["BBQ sauce", "dry rub spices", "paprika", "chili powder", "garlic powder", "onion powder", "cayenne", "brown sugar", "apple cider vinegar", "liquid smoke"],
  "flavor_profile": "smoky, sweet-tangy BBQ, charred, caramelized, bold and savory"
}',
'Focus on high-heat cooking for char and caramelization. Use dry rubs before cooking and sauce at the end. Common methods: grilled proteins, sheet pan BBQ chicken, smoky veggie sides, BBQ bowls with slaw.',
'Use BBQ-inspired names: "BBQ Pulled Chicken Bowl", "Grilled Steak with Chimichurri", "Smoky BBQ Salmon", "Charred Veggie Platter", "Kansas City Chicken & Beans"',
ARRAY['no_restrictions', 'gluten_free', 'dairy_free'],
ARRAY[]::TEXT[],
ARRAY[5,6,7,8]),

-- Breakfast Champions
('breakfast_champions', 'Breakfast Champions', 'Protein-packed morning fuel. Eggs, oats, Greek yogurt, and energizing starts.', '🍳',
'{
  "proteins": ["eggs", "egg whites", "greek yogurt", "cottage cheese", "turkey sausage", "chicken sausage", "smoked salmon", "protein powder"],
  "vegetables": ["spinach", "bell peppers", "mushrooms", "tomatoes", "onions", "kale", "avocado"],
  "fruits": ["berries", "banana", "apple", "peaches", "mango"],
  "grains": ["oats", "whole grain bread", "whole wheat tortillas", "quinoa", "sweet potato"],
  "fats": ["avocado", "almond butter", "peanut butter", "nuts", "seeds", "cheese", "olive oil"],
  "seasonings": ["cinnamon", "vanilla", "salt", "pepper", "garlic", "herbs", "honey", "maple syrup"],
  "flavor_profile": "savory or sweet depending on style, protein-forward, energizing, satisfying"
}',
'Focus on high-protein preparations that fuel morning training. Options for both savory (egg scrambles, breakfast burritos) and sweet (protein oats, yogurt parfaits). Common methods: egg bakes, overnight oats, smoothie bowls, breakfast burritos.',
'Use breakfast-focused names: "Power Breakfast Scramble", "Overnight Protein Oats", "Greek Yogurt Parfait", "Veggie Egg Muffins", "Breakfast Burrito Bowl"',
ARRAY['no_restrictions', 'gluten_free', 'vegetarian'],
ARRAY[]::TEXT[],
ARRAY[]::INT[]),

-- One-Pan Wonders
('one_pan_wonders', 'One-Pan Wonders', 'Minimal cleanup, maximum flavor. Sheet pan dinners and skillet meals that do it all.', '🍳',
'{
  "proteins": ["chicken thighs", "chicken breast", "salmon", "shrimp", "ground beef", "ground turkey", "sausage", "pork chops"],
  "vegetables": ["broccoli", "brussels sprouts", "sweet potatoes", "bell peppers", "zucchini", "asparagus", "green beans", "cherry tomatoes", "onions"],
  "fruits": ["lemon", "lime"],
  "grains": ["rice", "quinoa", "potatoes"],
  "fats": ["olive oil", "butter", "cheese"],
  "seasonings": ["garlic", "Italian seasoning", "paprika", "cumin", "oregano", "thyme", "lemon juice", "soy sauce", "balsamic vinegar"],
  "flavor_profile": "simple, well-seasoned, roasted or seared, versatile flavors"
}',
'Focus on efficient cooking with everything on one sheet pan or in one skillet. Proper seasoning and timing for cohesive meals. Common methods: sheet pan dinners (protein + veggies), one-skillet meals, foil packet cooking.',
'Use simple, practical names: "Sheet Pan Chicken & Veggies", "One-Pan Salmon Bake", "Skillet Turkey & Potatoes", "Easy Sausage & Brussels Sprouts", "Sheet Pan Fajitas"',
ARRAY['no_restrictions', 'gluten_free', 'dairy_free'],
ARRAY[]::TEXT[],
ARRAY[]::INT[]),

-- Seafood Focus
('seafood_focus', 'Seafood Focus', 'Ocean-fresh protein power. Salmon, shrimp, white fish, and omega-3 rich meals.', '🐟',
'{
  "proteins": ["salmon", "shrimp", "white fish", "cod", "tilapia", "mahi mahi", "tuna", "scallops", "crab"],
  "vegetables": ["asparagus", "spinach", "zucchini", "tomatoes", "bell peppers", "broccoli", "green beans", "arugula"],
  "fruits": ["lemon", "lime", "mango", "pineapple"],
  "grains": ["rice", "quinoa", "couscous", "whole grain bread"],
  "fats": ["olive oil", "butter", "avocado", "tahini"],
  "seasonings": ["lemon juice", "garlic", "dill", "parsley", "paprika", "old bay", "cajun seasoning", "ginger", "soy sauce", "capers"],
  "flavor_profile": "light, bright, lemony, herb-forward, clean ocean flavors"
}',
'Focus on quick-cooking methods that preserve delicate seafood texture. Emphasize lemon, herbs, and light sauces. Common methods: baked fish with veggies, pan-seared salmon, shrimp stir-fry, fish tacos, grilled seafood.',
'Use seafood-forward names: "Lemon Herb Salmon", "Cajun Shrimp Bowl", "Garlic Butter Cod", "Blackened Mahi Tacos", "Mediterranean Sea Bass"',
ARRAY['no_restrictions', 'gluten_free', 'dairy_free', 'paleo'],
ARRAY[]::TEXT[],
ARRAY[]::INT[]),

-- Tex-Mex
('tex_mex', 'Tex-Mex', 'Bold Southwest flavors. Cheese, peppers, smoky spices, and Tex-Mex comfort.', '🌶️',
'{
  "proteins": ["ground beef", "chicken breast", "steak", "ground turkey", "black beans", "pinto beans", "shredded cheese"],
  "vegetables": ["bell peppers", "onions", "jalapeños", "tomatoes", "corn", "lettuce", "avocado", "poblano peppers"],
  "fruits": ["lime", "tomatoes", "avocado"],
  "grains": ["brown rice", "tortillas", "corn tortillas", "black beans", "pinto beans", "quinoa"],
  "fats": ["cheddar cheese", "monterey jack", "sour cream", "avocado", "queso", "olive oil"],
  "seasonings": ["cumin", "chili powder", "paprika", "garlic powder", "oregano", "cayenne", "taco seasoning", "cilantro", "lime juice", "salsa", "hot sauce"],
  "flavor_profile": "bold, smoky-spicy, cheese-forward, tangy lime, hearty and satisfying"
}',
'Focus on layered flavors with cheese, spices, and bold seasonings. Build Tex-Mex favorites with quality ingredients. Common methods: burrito bowls, fajitas, enchiladas, loaded nachos, taco salads, queso-topped proteins.',
'Use Tex-Mex names: "Loaded Fajita Bowl", "Queso Chicken Bake", "Southwest Steak Salad", "Tex-Mex Turkey Skillet", "Smoky Black Bean Burrito Bowl"',
ARRAY['no_restrictions', 'gluten_free'],
ARRAY[]::TEXT[],
ARRAY[]::INT[]),

-- Peruvian
('peruvian', 'Peruvian', 'Vibrant Peruvian flavors. Quinoa, aji peppers, cilantro, and bold citrus.', '🇵🇪',
'{
  "proteins": ["chicken breast", "chicken thighs", "beef sirloin", "pork tenderloin", "white fish", "sea bass", "tilapia", "shrimp", "eggs"],
  "vegetables": ["bell peppers", "aji amarillo peppers", "tomatoes", "onions", "red onions", "corn", "lettuce", "cilantro", "sweet potatoes", "potatoes", "lima beans"],
  "fruits": ["lime", "avocado", "mango", "passion fruit"],
  "grains": ["quinoa", "white rice", "brown rice", "potatoes", "sweet potatoes", "corn"],
  "fats": ["avocado", "olive oil", "peanuts"],
  "seasonings": ["aji amarillo paste", "aji verde", "cilantro", "garlic", "cumin", "oregano", "lime juice", "red wine vinegar", "paprika", "huacatay"],
  "flavor_profile": "bright citrus, spicy aji peppers, cilantro-forward, garlicky, umami from soy sauce, fresh and bold"
}',
'Focus on bold marinades, high-heat cooking, and fresh herb sauces. Emphasize bright, zesty flavors with aji peppers and lime. Common methods: stir-fried lomo saltado, grilled anticuchos (skewers), rotisserie-style chicken, ceviche-inspired bowls, quinoa power bowls with aji verde.',
'Use Peruvian-inspired names: "Lomo Saltado Bowl", "Pollo a la Brasa with Aji Verde", "Peruvian Chicken Skewers", "Quinoa Power Bowl", "Aji Amarillo Shrimp", "Cilantro Lime Sea Bass"',
ARRAY['no_restrictions', 'gluten_free', 'dairy_free'],
ARRAY[]::TEXT[],
ARRAY[]::INT[]);

