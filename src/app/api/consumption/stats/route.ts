import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * User stats/wins for the profile page
 */
export interface UserStats {
  // 800g Challenge
  fruitVeg: {
    daysThisWeek: number;
    daysThisMonth: number;
    daysThisYear: number;
    currentStreak: number;
    longestStreak: number;
    totalGramsAllTime: number;
  };
  // Macro targets
  calories: {
    daysHitThisWeek: number;
    daysHitThisMonth: number;
    daysHitThisYear: number;
  };
  protein: {
    daysHitThisWeek: number;
    daysHitThisMonth: number;
    daysHitThisYear: number;
  };
  carbs: {
    daysHitThisWeek: number;
    daysHitThisMonth: number;
    daysHitThisYear: number;
  };
  fat: {
    daysHitThisWeek: number;
    daysHitThisMonth: number;
    daysHitThisYear: number;
  };
  // Logging activity
  logging: {
    totalDaysLogged: number;
    currentStreak: number;
    longestStreak: number;
    totalMealsLogged: number;
  };
  // Personal bests
  personalBests: {
    mostProteinInADay: number;
    mostVeggiesInADay: number;
    longestCalorieStreak: number;
  };
}

const FRUIT_VEG_GOAL_GRAMS = 800;
// Consider macro target "hit" if within 90% (allowing some flexibility)
const MACRO_HIT_THRESHOLD = 0.9;

/**
 * GET /api/consumption/stats
 *
 * Get aggregated user stats for the profile wins section.
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get user's daily macro targets
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('target_calories, target_protein, target_carbs, target_fat')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Calculate date ranges
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Week start (Monday)
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Month start
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    // Year start
    const yearStart = new Date(today.getFullYear(), 0, 1);
    const yearStartStr = yearStart.toISOString().split('T')[0];

    // Fetch all consumption data for the year (we'll filter in memory for different periods)
    const { data: entries, error: entriesError } = await supabase
      .from('meal_consumption_log')
      .select('consumed_date, calories, protein, carbs, fat, grams, ingredient_category, meal_type')
      .eq('user_id', user.id)
      .gte('consumed_date', yearStartStr)
      .lte('consumed_date', todayStr)
      .order('consumed_date', { ascending: true });

    if (entriesError) throw entriesError;

    // Aggregate by day
    type DailyStats = {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fruitVegGrams: number;
      entryCount: number;
      mealTypesLogged: Set<string>;
    };

    const dailyMap = new Map<string, DailyStats>();

    for (const entry of entries || []) {
      const date = entry.consumed_date;
      let dayStats = dailyMap.get(date);
      if (!dayStats) {
        dayStats = {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fruitVegGrams: 0,
          entryCount: 0,
          mealTypesLogged: new Set<string>(),
        };
        dailyMap.set(date, dayStats);
      }

      // Track unique meal type (null/undefined → 'unassigned')
      const mealType = entry.meal_type || 'unassigned';
      dayStats.mealTypesLogged.add(mealType);

      dayStats.calories += entry.calories || 0;
      dayStats.protein += entry.protein || 0;
      dayStats.carbs += entry.carbs || 0;
      dayStats.fat += entry.fat || 0;
      dayStats.entryCount += 1;

      // Count fruit/veg grams
      if (entry.ingredient_category === 'fruit' || entry.ingredient_category === 'vegetable') {
        dayStats.fruitVegGrams += entry.grams || 0;
      }
    }

    // Calculate stats
    const targets = {
      calories: profile.target_calories,
      protein: profile.target_protein,
      carbs: profile.target_carbs,
      fat: profile.target_fat,
    };

    // Initialize counters
    let fruitVegDaysWeek = 0, fruitVegDaysMonth = 0, fruitVegDaysYear = 0;
    let caloriesDaysWeek = 0, caloriesDaysMonth = 0, caloriesDaysYear = 0;
    let proteinDaysWeek = 0, proteinDaysMonth = 0, proteinDaysYear = 0;
    let carbsDaysWeek = 0, carbsDaysMonth = 0, carbsDaysYear = 0;
    let fatDaysWeek = 0, fatDaysMonth = 0, fatDaysYear = 0;
    let totalFruitVegGrams = 0;
    let mostProteinInADay = 0;
    let mostVeggiesInADay = 0;
    let totalMealsLogged = 0;

    // Sort dates for streak calculations
    const sortedDates = Array.from(dailyMap.keys()).sort();

    for (const [date, stats] of dailyMap) {
      const inWeek = date >= weekStartStr;
      const inMonth = date >= monthStartStr;

      // Count unique meal occasions (meal types with at least one entry)
      totalMealsLogged += stats.mealTypesLogged.size;
      totalFruitVegGrams += stats.fruitVegGrams;

      // Personal bests
      if (stats.protein > mostProteinInADay) mostProteinInADay = stats.protein;
      if (stats.fruitVegGrams > mostVeggiesInADay) mostVeggiesInADay = stats.fruitVegGrams;

      // 800g challenge
      if (stats.fruitVegGrams >= FRUIT_VEG_GOAL_GRAMS) {
        fruitVegDaysYear++;
        if (inMonth) fruitVegDaysMonth++;
        if (inWeek) fruitVegDaysWeek++;
      }

      // Calories (within threshold)
      if (stats.calories >= targets.calories * MACRO_HIT_THRESHOLD &&
          stats.calories <= targets.calories * 1.1) {
        caloriesDaysYear++;
        if (inMonth) caloriesDaysMonth++;
        if (inWeek) caloriesDaysWeek++;
      }

      // Protein (at least threshold)
      if (stats.protein >= targets.protein * MACRO_HIT_THRESHOLD) {
        proteinDaysYear++;
        if (inMonth) proteinDaysMonth++;
        if (inWeek) proteinDaysWeek++;
      }

      // Carbs (within range)
      if (stats.carbs >= targets.carbs * MACRO_HIT_THRESHOLD &&
          stats.carbs <= targets.carbs * 1.15) {
        carbsDaysYear++;
        if (inMonth) carbsDaysMonth++;
        if (inWeek) carbsDaysWeek++;
      }

      // Fat (within range)
      if (stats.fat >= targets.fat * MACRO_HIT_THRESHOLD &&
          stats.fat <= targets.fat * 1.15) {
        fatDaysYear++;
        if (inMonth) fatDaysMonth++;
        if (inWeek) fatDaysWeek++;
      }
    }

    // Calculate streaks
    const calculateStreak = (dates: string[], checkFn: (stats: DailyStats) => boolean): { current: number; longest: number } => {
      let current = 0;
      let longest = 0;
      let tempStreak = 0;
      let prevDate: Date | null = null;

      // Start from most recent to calculate current streak
      const reversedDates = [...dates].reverse();
      let stillCounting = true;

      for (const dateStr of reversedDates) {
        const stats = dailyMap.get(dateStr);
        if (!stats) continue;

        const currentDate = new Date(dateStr);
        const meetsCondition = checkFn(stats);

        if (stillCounting && meetsCondition) {
          // Check if this is consecutive (or first day)
          if (prevDate === null) {
            // First day - check if it's today or yesterday
            const diffFromToday = Math.floor((today.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffFromToday <= 1) {
              current = 1;
              prevDate = currentDate;
            } else {
              stillCounting = false;
            }
          } else {
            const diff = Math.floor((prevDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diff === 1) {
              current++;
              prevDate = currentDate;
            } else {
              stillCounting = false;
            }
          }
        } else if (stillCounting) {
          stillCounting = false;
        }
      }

      // Calculate longest streak (forward pass)
      prevDate = null;
      tempStreak = 0;

      for (const dateStr of dates) {
        const stats = dailyMap.get(dateStr);
        if (!stats) continue;

        const currentDate = new Date(dateStr);
        const meetsCondition = checkFn(stats);

        if (meetsCondition) {
          if (prevDate === null) {
            tempStreak = 1;
          } else {
            const diff = Math.floor((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diff === 1) {
              tempStreak++;
            } else {
              tempStreak = 1;
            }
          }
          prevDate = currentDate;
          if (tempStreak > longest) longest = tempStreak;
        } else {
          tempStreak = 0;
          prevDate = null;
        }
      }

      return { current, longest };
    };

    const fruitVegStreaks = calculateStreak(sortedDates, (s) => s.fruitVegGrams >= FRUIT_VEG_GOAL_GRAMS);
    const loggingStreaks = calculateStreak(sortedDates, (s) => s.entryCount > 0);
    const calorieStreaks = calculateStreak(sortedDates, (s) =>
      s.calories >= targets.calories * MACRO_HIT_THRESHOLD &&
      s.calories <= targets.calories * 1.1
    );

    const stats: UserStats = {
      fruitVeg: {
        daysThisWeek: fruitVegDaysWeek,
        daysThisMonth: fruitVegDaysMonth,
        daysThisYear: fruitVegDaysYear,
        currentStreak: fruitVegStreaks.current,
        longestStreak: fruitVegStreaks.longest,
        totalGramsAllTime: Math.round(totalFruitVegGrams),
      },
      calories: {
        daysHitThisWeek: caloriesDaysWeek,
        daysHitThisMonth: caloriesDaysMonth,
        daysHitThisYear: caloriesDaysYear,
      },
      protein: {
        daysHitThisWeek: proteinDaysWeek,
        daysHitThisMonth: proteinDaysMonth,
        daysHitThisYear: proteinDaysYear,
      },
      carbs: {
        daysHitThisWeek: carbsDaysWeek,
        daysHitThisMonth: carbsDaysMonth,
        daysHitThisYear: carbsDaysYear,
      },
      fat: {
        daysHitThisWeek: fatDaysWeek,
        daysHitThisMonth: fatDaysMonth,
        daysHitThisYear: fatDaysYear,
      },
      logging: {
        totalDaysLogged: dailyMap.size,
        currentStreak: loggingStreaks.current,
        longestStreak: loggingStreaks.longest,
        totalMealsLogged,
      },
      personalBests: {
        mostProteinInADay: Math.round(mostProteinInADay),
        mostVeggiesInADay: Math.round(mostVeggiesInADay),
        longestCalorieStreak: calorieStreaks.longest,
      },
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user stats' },
      { status: 500 }
    );
  }
}
