(function(){
  "use strict";

  /* ============================================================
     EDITABLE FOOD METRICS
     All per-100g figures are for the COOKED (or, for raw-eaten
     items like cucumber, as-eaten) form of the food.
     Sources: typical USDA FoodData Central averages — real
     products vary, so treat these as planning defaults, not
     lab-grade nutrition facts.
     ============================================================ */
  var FOOD_DB = {
    protein: {
      chicken_breast: {
        label: "Chicken Breast",
        methods: { boiled: 0.82, air_fried: 0.74, grilled: 0.72, baked: 0.75 },
        proteinPer100g: 31, fatPer100g: 3.6, carbsPer100g: 0, fiberPer100g: 0, kcalPer100g: 165
      },
      chicken_thigh: {
        label: "Chicken Thigh",
        methods: { boiled: 0.75, air_fried: 0.75, grilled: 0.75, baked: 0.75 },
        proteinPer100g: 26, fatPer100g: 10, carbsPer100g: 0, fiberPer100g: 0, kcalPer100g: 209
      },
      tofu: {
        label: "Tofu",
        methods: { boiled: 0.90, air_fried: 0.70, grilled: 0.78, baked: 0.80 },
        proteinPer100g: 8, fatPer100g: 4.8, carbsPer100g: 2, fiberPer100g: 0.7, kcalPer100g: 76
      },
      paneer: {
        label: "Paneer",
        methods: { boiled: 0.92, air_fried: 0.80, grilled: 0.85, baked: 0.85 },
        proteinPer100g: 18, fatPer100g: 20, carbsPer100g: 1.2, fiberPer100g: 0, kcalPer100g: 265
      }
    },
    carb: {
      white_rice:   { label: "White Rice",   factor: 3.0,  carbsPer100g: 28, proteinPer100g: 2.7, fatPer100g: 0.3, fiberPer100g: 0.4, kcalPer100g: 130 },
      basmati_rice: { label: "Basmati Rice", factor: 2.9,  carbsPer100g: 25, proteinPer100g: 2.7, fatPer100g: 0.4, fiberPer100g: 0.5, kcalPer100g: 121 },
      brown_rice:   { label: "Brown Rice",   factor: 2.7,  carbsPer100g: 23, proteinPer100g: 2.6, fatPer100g: 0.9, fiberPer100g: 1.8, kcalPer100g: 112 },
      pasta:        { label: "Pasta",        factor: 2.25, carbsPer100g: 25, proteinPer100g: 5.8, fatPer100g: 0.9, fiberPer100g: 1.8, kcalPer100g: 131 }
    },
    veg: {
      broccoli:         { label: "Broccoli",          yield: 0.85, fiberPer100g: 3.3, proteinPer100g: 2.8, carbsPer100g: 7.0, fatPer100g: 0.4, kcalPer100g: 35 },
      carrots:          { label: "Carrots",           yield: 0.90, fiberPer100g: 3.0, proteinPer100g: 0.8, carbsPer100g: 8.2, fatPer100g: 0.3, kcalPer100g: 35 },
      cucumber:         { label: "Cucumber",          yield: 1.00, fiberPer100g: 0.5, proteinPer100g: 0.65, carbsPer100g: 3.6, fatPer100g: 0.1, kcalPer100g: 15 },
      mixed_vegetables: { label: "Mixed Vegetables",  yield: 0.88, fiberPer100g: 3.0, proteinPer100g: 2.6, carbsPer100g: 8.0, fatPer100g: 0.3, kcalPer100g: 42 }
    },
    fat: {
      olive_oil:     { label: "Olive Oil",          fatPer100g: 100, proteinPer100g: 0,  carbsPer100g: 0,  fiberPer100g: 0,   kcalPer100g: 884 },
      peanut_butter: { label: "Peanut Butter",      fatPer100g: 50,  proteinPer100g: 25, carbsPer100g: 20, fiberPer100g: 6,   kcalPer100g: 588 },
      almonds:       { label: "Almonds",            fatPer100g: 49,  proteinPer100g: 21, carbsPer100g: 22, fiberPer100g: 12.5, kcalPer100g: 579 }
    }
  };

  /* Default veg mix used for auto-suggestion, in a fixed rotation */
  var VEG_SUGGEST_ORDER = ["broccoli", "carrots", "cucumber"];

  var METHOD_LABELS = {
    boiled: "Boiled", air_fried: "Air Fried", grilled: "Grilled", baked: "Baked"
  };

  var KG_TO_LB = 2.20462;
  var LB_TO_KG = 1 / 2.20462;
  var CM_TO_IN = 1 / 2.54;
  var IN_TO_CM = 2.54;
  var KCAL_PER_KG_FAT = 7700;

  var GOAL_LABELS = { cut: "Lose fat (cut)", maintain: "Maintain weight", leanbulk: "Lean bulk", bulk: "Build muscle (bulk)" };

  /* Evidence-based calorie adjustment ranges, as a % of TDEE (ISSN / ACSM-style
     planning ranges). Goal pace (0 = low end, 1 = high end) picks a point in
     the range instead of ever hardcoding a flat 500 kcal. */
  var GOAL_CALORIE_RANGE_PCT = {
    cut:      [15, 20],
    maintain: [0, 0],
    leanbulk: [8, 10],
    bulk:     [15, 20]
  };

  /* Body-fat category ranges (ACE-style), percent body fat. */
  var BODY_FAT_CATEGORIES = {
    male:   [ ["Essential fat", 0, 5], ["Athlete", 6, 13], ["Fitness", 14, 17], ["Average", 18, 24], ["Obese", 25, 100] ],
    female: [ ["Essential fat", 0, 13], ["Athlete", 14, 20], ["Fitness", 21, 24], ["Average", 25, 31], ["Obese", 32, 100] ]
  };

  var MIN_CALORIES = { male: 1500, female: 1200 };

  /* ============================================================
     PLAIN-LANGUAGE GLOSSARY (tooltip contents)
     ============================================================ */
  var TOOLTIPS = {
    totalMeals: "How many separate meals you're prepping in total: people × meals per day × days. Feed 3 friends 2 meals a day for 5 days, and that's 30 meals total.",
    cookedTarget: "How much the food should weigh AFTER it's cooked - what actually lands on the plate. Not the raw weight you started with.",
    cookingYield: "Cooking drives off water and fat, so cooked food weighs less than raw. A 74% yield means 100g raw becomes about 74g once cooked.",
    expansionFactor: "Rice and pasta do the opposite of meat - they soak up water and get heavier as they cook. A factor of 3 means the cooked weight ends up 3× the dry weight you started with.",
    rawNeeded: "The actual amount to buy at the store, uncooked - before water is lost (protein/veg) or gained (rice/pasta) during cooking.",
    mealPrepBoxes: "One container per meal. Prep 30 meals total, and that's 30 boxes to fill and store — based on the number of people, meals per day, and days.",
    customOverride: "Weighed your own batch and got a different number than our default? Type it here and everything recalculates using your real number instead of our estimate.",
    tdeeIntro: "BMR is the energy your body burns at total rest. TDEE multiplies that by your activity level to estimate total daily burn. Your calorie target then adjusts TDEE up or down based on your goal and chosen pace.",
    sexBmr: "The Mifflin–St Jeor formula uses a different constant for men and women because of average differences in body composition. If this doesn't reflect you, treat the result as a rough starting point and adjust based on real-world results.",
    targetWeight: "Optional - enter a goal body weight in the same unit as your current weight. We'll estimate how many weeks it'll take at your chosen pace.",
    weeklyRate: "How fast you want to change weight, as a percentage of your current body weight per week. Faster paces mean a bigger calorie deficit or surplus - usually 0.25–1% per week is sustainable for most people.",
    goalType: "Cutting creates a calorie deficit to lose fat, bulking creates a surplus to build muscle, and maintaining keeps calories at your estimated TDEE.",
    activityLevel: "How much you move in a typical week outside of just existing. This multiplies your BMR to estimate total daily calorie burn (TDEE).",
    fatPercent: "What share of your daily calories comes from fat. 20–35% is a common healthy range; higher-fat, lower-carb approaches sit at the top end, higher-carb approaches at the bottom.",
    calorieTarget: "Your estimated daily calorie need, adjusted for your goal: TDEE minus a deficit (cut), TDEE plus a surplus (bulk), or TDEE unchanged (maintain).",
    proteinFactor: "A common planning formula: recommended daily protein (g) = body weight (kg) × a factor (g per kg) that depends on your goal. It's a general guideline, not a medical prescription.",
    fiberTarget: "Based on the Institute of Medicine guideline of about 14 g of fiber per 1,000 kcal eaten - so higher calorie targets come with a higher fiber target too.",
    proteinDensity: "How many grams of pure protein are packed into 100 grams of the cooked food. Chicken breast is protein-dense; tofu is much less so by weight — this is what lets us estimate protein per meal.",
    carbDensity: "How many grams of carbohydrate are packed into 100 grams of the cooked food. Rice and pasta are carb-dense - this is what lets us estimate carbs per meal.",
    fiberDensity: "How many grams of dietary fiber are packed into 100 grams of the cooked vegetable - this is what lets us estimate how much of your daily fiber goal one serving covers.",
    fatDensity: "How many grams of fat are packed into 100 grams of the food. Oils are almost pure fat; nuts and nut butters carry meaningful protein and carbs alongside their fat.",
    percentDaily: "What share of your daily recommended amount a single meal provides, based on the food and cooked portion you entered.",
    vegSuggestTip: "If your selected veggie doesn't fully cover your daily fiber target, this splits the remaining fiber gap across a rotation of broccoli, carrots, and cucumber and tells you roughly how many grams of each to add across the day.",
    bodyFatPct: "Optional. If you know your real body fat %, entering it switches your BMR formula to Katch–McArdle (based on lean mass) - usually more accurate than Mifflin–St Jeor for lean or very muscular people. Leave it blank and we'll auto-estimate a body fat % from your BMI, age, and sex (a rough planning number, not a substitute for a skinfold, DEXA, or bioimpedance reading) so lean mass, FFMI, and body-fat category still show — BMR keeps using Mifflin–St Jeor in that case.",
    targetBodyFat: "Optional. Enter the body fat % you're aiming for. We hold your lean body mass steady (the muscle/bone/organ weight you'd keep) and back-calculate the body weight you'd be at that lean mass and this target body fat % — shown as 'Suggested body weight' to the right and in the Body Composition card below.",
    suggestedWeight: "Suggested body weight = lean body mass ÷ (1 − target body fat % ÷ 100). This assumes your lean mass (muscle, bone, organs, water) stays the same while body fat changes - in reality some lean mass is usually gained or lost too, so treat this as a planning estimate rather than an exact destination.",
    mealsPerDayNutrition: "How many meals you split your day's food into. Used only to divide your daily calorie and macro targets evenly across meals below — it doesn't change the daily totals themselves.",
    mealBreakdown: "Your daily calories, protein, fat, carbs, and fiber divided evenly by the number of meals you plan to eat. Real meals don't have to be perfectly even — this is a simple starting point.",
    foodRecommend: "Works backward from your whole day's protein, carb, and fiber targets to the amount of food (cooked/plate weight, and raw/shopping weight) needed for the entire day, using the foods and cooking methods selected in Part 2 below."
  };

  /* ============================================================
     STATE
     ============================================================ */
  var els = {};

  document.addEventListener("DOMContentLoaded", init);

  function init(){
    cacheEls();
    buildFoodLists();
    buildProteinFoodSelect();
    bindEvents();
    bindTabs();
    bindTooltips();
    updateLiveScale();
  }

  function cacheEls(){
    els.people = document.getElementById("people");
    els.mealsPerDay = document.getElementById("mealsPerDay");
    els.days = document.getElementById("days");
    els.errPeople = document.getElementById("err-people");
    els.errMealsPerDay = document.getElementById("err-mealsPerDay");
    els.errDays = document.getElementById("err-days");
    els.errFoods = document.getElementById("err-foods");
    els.liveTotalMeals = document.getElementById("liveTotalMeals");
    els.scaleStrip = document.getElementById("scaleStrip");
    els.calcBtn = document.getElementById("calcBtn");
    els.resetBtn = document.getElementById("resetBtn");
    els.exportBtn = document.getElementById("exportBtn");
    els.results = document.getElementById("results");
    els.factsCard = document.getElementById("factsCard");
    els.fFormula = document.getElementById("fFormula");
    els.fBoxes = document.getElementById("fBoxes");
    els.fItems = document.getElementById("fItems");

    els.tooltipPopover = document.getElementById("tooltipPopover");
    els.tooltipText = document.getElementById("tooltipText");
    els.tooltipClose = document.getElementById("tooltipClose");

    // TDEE / daily targets (Part 1)
    els.sex = document.getElementById("sex");
    els.age = document.getElementById("age");
    els.height = document.getElementById("height");
    els.heightUnit = document.getElementById("heightUnit");
    els.heightFtInWrap = document.getElementById("heightFtInWrap");
    els.heightFeet = document.getElementById("heightFeet");
    els.heightInches = document.getElementById("heightInches");
    els.heightHint = document.getElementById("heightHint");
    els.bodyWeight = document.getElementById("bodyWeight");
    els.bodyWeightUnit = document.getElementById("bodyWeightUnit");
    els.targetWeight = document.getElementById("targetWeight");
    els.bodyFatPercent = document.getElementById("bodyFatPercent");
    els.bodyFatHint = document.getElementById("bodyFatHint");
    els.targetBodyFatPercent = document.getElementById("targetBodyFatPercent");
    els.suggestedWeightReadout = document.getElementById("suggestedWeightReadout");
    els.tSuggestedWeight = document.getElementById("tSuggestedWeight");
    els.weeklyRate = document.getElementById("weeklyRate");
    els.goalType = document.getElementById("goalType");
    els.activityLevel = document.getElementById("activityLevel");
    els.fatPercent = document.getElementById("fatPercent");
    els.nutritionMealsPerDay = document.getElementById("nutritionMealsPerDay");
    els.warningsBox = document.getElementById("warningsBox");
    els.proteinFormulaOut = document.getElementById("proteinFormulaOut");
    els.tdeeResult = document.getElementById("tdeeResult");
    els.tCalories = document.getElementById("tCalories");
    els.tProtein = document.getElementById("tProtein");
    els.tFat = document.getElementById("tFat");
    els.tCarbs = document.getElementById("tCarbs");
    els.tFiber = document.getElementById("tFiber");
    els.tBmrTdee = document.getElementById("tBmrTdee");
    els.tWater = document.getElementById("tWater");
    els.tBmi = document.getElementById("tBmi");
    els.tBmiCategory = document.getElementById("tBmiCategory");
    els.tLbm = document.getElementById("tLbm");
    els.tFfmi = document.getElementById("tFfmi");
    els.tBfCategory = document.getElementById("tBfCategory");
    els.tdeeFormulaOut = document.getElementById("tdeeFormulaOut");
    els.tdeeProjectionOut = document.getElementById("tdeeProjectionOut");
    els.tdeeExportBtn = document.getElementById("tdeeExportBtn");

    // Meal breakdown (Part 1b)
    els.mealBreakdownResult = document.getElementById("mealBreakdownResult");
    els.mealBreakdownGrid = document.getElementById("mealBreakdownGrid");
    els.mealBreakdownEmpty = document.getElementById("mealBreakdownEmpty");

    // Full-day food recommendation (Part 1c)
    els.foodRecommendResult = document.getElementById("foodRecommendResult");
    els.foodRecommendFormula = document.getElementById("foodRecommendFormula");
    els.foodRecommendGrid = document.getElementById("foodRecommendGrid");
    els.foodRecommendEmpty = document.getElementById("foodRecommendEmpty");

    // Meal coverage (Part 2)
    els.proteinFoodSelect = document.getElementById("proteinFoodSelect");
    els.proteinMealGrams = document.getElementById("proteinMealGrams");
    els.proteinDensityInput = document.getElementById("proteinDensityInput");
    els.carbFoodSelect = document.getElementById("carbFoodSelect");
    els.carbMealGrams = document.getElementById("carbMealGrams");
    els.carbDensityInput = document.getElementById("carbDensityInput");
    els.vegFoodSelect = document.getElementById("vegFoodSelect");
    els.vegMealGrams = document.getElementById("vegMealGrams");
    els.fiberDensityInput = document.getElementById("fiberDensityInput");
    els.fatFoodSelect = document.getElementById("fatFoodSelect");
    els.fatMealGrams = document.getElementById("fatMealGrams");
    els.fatDensityInput = document.getElementById("fatDensityInput");
    els.syncFromCalcBtn = document.getElementById("syncFromCalcBtn");
    els.proteinCalcBtn = document.getElementById("proteinCalcBtn");
    els.proteinResult = document.getElementById("proteinResult");
    els.proteinFormula2Out = document.getElementById("proteinFormula2Out");
    els.pCaloriesPerMeal = document.getElementById("pCaloriesPerMeal");
    els.pProteinPerMeal = document.getElementById("pProteinPerMeal");
    els.pFatPerMeal = document.getElementById("pFatPerMeal");
    els.pCarbsPerMeal = document.getElementById("pCarbsPerMeal");
    els.pFiberPerMeal = document.getElementById("pFiberPerMeal");
    els.pCaloriesPercentDaily = document.getElementById("pCaloriesPercentDaily");
    els.pPercentDaily = document.getElementById("pPercentDaily");
    els.pFatPercentDaily = document.getElementById("pFatPercentDaily");
    els.pCarbsPercentDaily = document.getElementById("pCarbsPercentDaily");
    els.pFiberPercentDaily = document.getElementById("pFiberPercentDaily");
    els.vegSuggest = document.getElementById("vegSuggest");
    els.vegSuggestIntro = document.getElementById("vegSuggestIntro");
    els.vegSuggestGrid = document.getElementById("vegSuggestGrid");
    els.mealExportWrap = document.getElementById("mealExportWrap");
    els.mealExportBtn = document.getElementById("mealExportBtn");
  }

  /* ============================================================
     TABS
     ============================================================ */
  function bindTabs(){
    document.querySelectorAll(".tab").forEach(function(tab){
      tab.addEventListener("click", function(){
        document.querySelectorAll(".tab").forEach(function(t){
          t.classList.remove("is-active");
          t.setAttribute("aria-selected", "false");
        });
        document.querySelectorAll(".tab-panel").forEach(function(p){ p.hidden = true; });

        tab.classList.add("is-active");
        tab.setAttribute("aria-selected", "true");
        document.getElementById(tab.dataset.target).hidden = false;
        hideTooltip();
      });
    });
  }

  /* ============================================================
     TOOLTIPS
     ============================================================ */
  function bindTooltips(){
    document.addEventListener("click", function(e){
      var icon = e.target.closest(".info-icon");
      if (icon){
        var key = icon.dataset.tipKey;
        var text = TOOLTIPS[key];
        if (!text) return;
        var isOpen = els.tooltipPopover.dataset.openFor === key && !els.tooltipPopover.hidden;
        if (isOpen){ hideTooltip(); return; }
        showTooltip(icon, text, key);
        return;
      }
      if (!e.target.closest(".tooltip-popover")){
        hideTooltip();
      }
    });
    els.tooltipClose.addEventListener("click", hideTooltip);
    window.addEventListener("scroll", hideTooltip, { passive: true });
    window.addEventListener("resize", hideTooltip);
  }

  function showTooltip(icon, text, key){
    document.querySelectorAll('.info-icon[aria-expanded="true"]').forEach(function(i){
      i.setAttribute("aria-expanded", "false");
    });
    icon.setAttribute("aria-expanded", "true");
    els.tooltipText.textContent = text;
    els.tooltipPopover.hidden = false;
    els.tooltipPopover.dataset.openFor = key;

    var rect = icon.getBoundingClientRect();
    var popW = 300;
    var vw = window.innerWidth;
    var left = Math.min(Math.max(12, rect.left - 10), vw - popW - 12);
    var top = rect.bottom + 10;
    var flip = false;

    if (top + 140 > window.innerHeight){
      top = rect.top - 10;
      flip = true;
    }

    els.tooltipPopover.style.left = left + "px";
    els.tooltipPopover.style.top = flip ? "" : top + "px";
    els.tooltipPopover.style.bottom = flip ? (window.innerHeight - rect.top + 10) + "px" : "";
    els.tooltipPopover.classList.toggle("arrow-bottom", flip);
    els.tooltipPopover.style.setProperty("--arrow-left", (rect.left - left + 10) + "px");
  }

  function hideTooltip(){
    if (!els.tooltipPopover) return;
    els.tooltipPopover.hidden = true;
    els.tooltipPopover.dataset.openFor = "";
    document.querySelectorAll('.info-icon[aria-expanded="true"]').forEach(function(i){
      i.setAttribute("aria-expanded", "false");
    });
  }

  /* ============================================================
     BUILD FOOD SELECTION UI (Meal Prep tab)
     ============================================================ */
  function buildFoodLists(){
    buildCategory("protein", document.getElementById("list-protein"));
    buildCategory("carb", document.getElementById("list-carb"));
    buildCategory("veg", document.getElementById("list-veg"));
  }

  function buildCategory(category, container){
    var entries = FOOD_DB[category];
    Object.keys(entries).forEach(function(key){
      var item = entries[key];
      var el = document.createElement("div");
      el.className = "food-item";
      el.dataset.category = category;
      el.dataset.key = key;

      var badgeText = category === "carb"
        ? "expansion ×" + item.factor.toFixed(2)
        : (category === "veg" ? "yield " + Math.round(item.yield * 100) + "%" : "yield varies by method");

      var html = "";
      html += '<div class="food-item__head">';
      html += '<input type="checkbox" id="chk-' + category + '-' + key + '" data-role="toggle">';
      html += '<span class="food-item__name">' + item.label + '</span>';
      html += '<span class="food-item__badge">' + badgeText + '</span>';
      html += '</div>';
      html += '<div class="food-item__body">';

      html += '<label class="field"><span class="field__label">Cooked target per meal (g)';
      html += '<button class="info-icon" type="button" data-tip-key="cookedTarget" aria-label="What does this mean?">i</button></span>';
      html += '<input type="number" min="1" step="1" placeholder="e.g. 200" data-role="grams"></label>';

      if (category === "protein"){
        html += '<label class="field"><span class="field__label">Cooking method';
        html += '<button class="info-icon" type="button" data-tip-key="cookingYield" aria-label="What does this mean?">i</button></span>';
        html += '<select data-role="method">';
        Object.keys(item.methods).forEach(function(m){
          html += '<option value="' + m + '">' + METHOD_LABELS[m] + ' (yield ' + Math.round(item.methods[m]*100) + '%)</option>';
        });
        html += '</select></label>';
        html += '<label class="field"><span class="field__label">Custom yield override (optional, 0–1)';
        html += '<button class="info-icon" type="button" data-tip-key="customOverride" aria-label="What does this mean?">i</button></span>';
        html += '<input type="number" min="0.01" max="1" step="0.01" placeholder="e.g. 0.78" data-role="customYield"></label>';
      } else if (category === "carb"){
        html += '<label class="field"><span class="field__label">Custom expansion factor (optional)';
        html += '<button class="info-icon" type="button" data-tip-key="expansionFactor" aria-label="What does this mean?">i</button></span>';
        html += '<input type="number" min="0.5" step="0.05" placeholder="e.g. ' + item.factor + '" data-role="customFactor"></label>';
      } else {
        html += '<label class="field"><span class="field__label">Custom yield override (optional, 0–1)';
        html += '<button class="info-icon" type="button" data-tip-key="customOverride" aria-label="What does this mean?">i</button></span>';
        html += '<input type="number" min="0.01" max="1" step="0.01" placeholder="e.g. ' + item.yield + '" data-role="customYield"></label>';
      }

      html += '<span class="food-item__yield-note">Editable — leave blank to use the default above.</span>';
      html += '</div>';

      el.innerHTML = html;
      container.appendChild(el);

      var checkbox = el.querySelector('[data-role="toggle"]');
      var head = el.querySelector(".food-item__head");
      head.addEventListener("click", function(e){
        if (e.target !== checkbox){ checkbox.checked = !checkbox.checked; }
        el.classList.toggle("is-checked", checkbox.checked);
        clearError(els.errFoods);
      });
      checkbox.addEventListener("click", function(e){ e.stopPropagation(); });
      checkbox.addEventListener("change", function(){
        el.classList.toggle("is-checked", checkbox.checked);
        clearError(els.errFoods);
      });
    });
  }

  /* ============================================================
     EVENTS
     ============================================================ */
  function bindEvents(){
    [els.mealsPerDay, els.days].forEach(function(input){
      input.addEventListener("input", function(){
        clearError(errElFor(input));
        updateLiveScale();
      });
    });
    els.people.addEventListener("input", function(){
      clearError(errElFor(els.people));
      updateLiveScale();
    });

    els.calcBtn.addEventListener("click", handleCalculate);
    els.resetBtn.addEventListener("click", handleReset);
    els.exportBtn.addEventListener("click", function(){ exportCardAsPng(els.factsCard, "meal-prep-grocery-facts.png", els.exportBtn); });

    // Height unit toggle: swap between single input (cm/in) and feet+inches pair
    els.heightUnit.addEventListener("change", function(){
      var isFtIn = els.heightUnit.value === "ftin";
      els.height.hidden = isFtIn;
      els.heightFtInWrap.hidden = !isFtIn;
      updateTdeePreview();
    });

    // TDEE inputs — recompute live once enough info is present
    [els.sex, els.age, els.height, els.heightUnit, els.heightFeet, els.heightInches,
     els.bodyWeight, els.bodyWeightUnit, els.targetWeight, els.bodyFatPercent, els.targetBodyFatPercent,
     els.weeklyRate, els.goalType, els.activityLevel, els.fatPercent, els.nutritionMealsPerDay
    ].forEach(function(input){
      var evt = (input.tagName === "SELECT") ? "change" : "input";
      input.addEventListener(evt, updateTdeePreview);
    });
    els.tdeeExportBtn.addEventListener("click", function(){
      if (els.tdeeResult.hidden){
        alert("Fill in your sex, age, height, and body weight first to see your daily targets.");
        return;
      }
      exportCardAsPng(els.tdeeResult, "daily-calorie-macro-targets.png", els.tdeeExportBtn);
    });

    els.proteinFoodSelect.addEventListener("change", function(){
      var key = els.proteinFoodSelect.value;
      els.proteinDensityInput.value = FOOD_DB.protein[key].proteinPer100g;
      updateTdeePreview();
    });
    els.carbFoodSelect.addEventListener("change", function(){
      var key = els.carbFoodSelect.value;
      els.carbDensityInput.value = FOOD_DB.carb[key].carbsPer100g;
      updateTdeePreview();
    });
    els.vegFoodSelect.addEventListener("change", function(){
      var key = els.vegFoodSelect.value;
      els.fiberDensityInput.value = FOOD_DB.veg[key].fiberPer100g;
      updateTdeePreview();
    });
    els.fatFoodSelect.addEventListener("change", function(){
      var key = els.fatFoodSelect.value;
      els.fatDensityInput.value = FOOD_DB.fat[key].fatPer100g;
    });
    [els.proteinDensityInput, els.carbDensityInput, els.fiberDensityInput].forEach(function(input){
      input.addEventListener("input", updateTdeePreview);
    });
    els.syncFromCalcBtn.addEventListener("click", syncFromCalculator);
    els.proteinCalcBtn.addEventListener("click", handleProteinCalculate);
    els.mealExportBtn.addEventListener("click", function(){ exportCardAsPng(els.proteinResult, "meal-macro-coverage.png", els.mealExportBtn); });
  }

  function errElFor(input){
    if (input === els.people) return els.errPeople;
    if (input === els.mealsPerDay) return els.errMealsPerDay;
    if (input === els.days) return els.errDays;
    return null;
  }

  function updateLiveScale(){
    var p = parseFloat(els.people.value);
    var m = parseFloat(els.mealsPerDay.value);
    var d = parseFloat(els.days.value);
    var valid = p > 0 && m > 0 && d > 0;

    var boxes = valid ? Math.round(p * m * d) : 0;
    els.liveTotalMeals.textContent = boxes;
  }

  /* ============================================================
     VALIDATION (Meal Prep tab)
     ============================================================ */
  function validateBasics(){
    var ok = true;
    var p = parseFloat(els.people.value);
    var m = parseFloat(els.mealsPerDay.value);
    var d = parseFloat(els.days.value);

    clearError(els.errPeople); clearError(els.errMealsPerDay); clearError(els.errDays);

    if (!(p > 0)){ setError(els.errPeople, "Enter a number of people greater than 0."); ok = false; }
    if (!(m > 0)){ setError(els.errMealsPerDay, "Enter meals per day greater than 0."); ok = false; }
    if (!(d > 0)){ setError(els.errDays, "Enter a number of days greater than 0."); ok = false; }

    if (!ok) return null;
    return { people: p, mealsPerDay: m, days: d };
  }

  function setError(el, msg){
    if (!el) return;
    el.textContent = msg;
    var input = el.parentElement ? el.parentElement.querySelector("input") : null;
    if (input) input.classList.add("is-invalid");
  }
  function clearError(el){
    if (!el) return;
    el.textContent = "";
    var input = el.parentElement ? el.parentElement.querySelector("input") : null;
    if (input) input.classList.remove("is-invalid");
  }

  function collectSelectedFoods(){
    var selected = [];
    var invalidGrams = false;
    document.querySelectorAll(".food-item.is-checked").forEach(function(el){
      var category = el.dataset.category;
      var key = el.dataset.key;
      var gramsInput = el.querySelector('[data-role="grams"]');
      var grams = parseFloat(gramsInput.value);

      if (!(grams > 0)){
        gramsInput.classList.add("is-invalid");
        invalidGrams = true;
        return;
      }
      gramsInput.classList.remove("is-invalid");

      var entry = { category: category, key: key, label: FOOD_DB[category][key].label, gramsPerMeal: grams };

      if (category === "protein"){
        var method = el.querySelector('[data-role="method"]').value;
        var customYield = parseFloat(el.querySelector('[data-role="customYield"]').value);
        var defaultYield = FOOD_DB.protein[key].methods[method];
        entry.method = method;
        entry.yield = (customYield > 0 && customYield <= 1) ? customYield : defaultYield;
        entry.usedCustom = customYield > 0 && customYield <= 1;
      } else if (category === "carb"){
        var customFactor = parseFloat(el.querySelector('[data-role="customFactor"]').value);
        var defaultFactor = FOOD_DB.carb[key].factor;
        entry.factor = (customFactor > 0) ? customFactor : defaultFactor;
        entry.usedCustom = customFactor > 0;
      } else {
        var customYieldV = parseFloat(el.querySelector('[data-role="customYield"]').value);
        var defaultYieldV = FOOD_DB.veg[key].yield;
        entry.yield = (customYieldV > 0 && customYieldV <= 1) ? customYieldV : defaultYieldV;
        entry.usedCustom = customYieldV > 0 && customYieldV <= 1;
      }

      selected.push(entry);
    });

    return { selected: selected, invalidGrams: invalidGrams };
  }

  /* ============================================================
     CALCULATE (Meal Prep tab)
     ============================================================ */
  function handleCalculate(){
    clearError(els.errFoods);
    var basics = validateBasics();

    var checkedItems = document.querySelectorAll(".food-item.is-checked").length;
    if (checkedItems === 0){
      setError(els.errFoods, "Select at least one food item and set its cooked target.");
    }

    var foodData = collectSelectedFoods();
    if (foodData.invalidGrams){
      setError(els.errFoods, "Enter a cooked target (grams) greater than 0 for every checked item.");
    }

    if (!basics || checkedItems === 0 || foodData.invalidGrams || foodData.selected.length === 0){
      els.results.hidden = true;
      return;
    }

    var boxes = Math.round(basics.people * basics.mealsPerDay * basics.days);

    renderResults(basics, boxes, foodData.selected);
  }

  function renderResults(basics, boxes, items){
    els.fBoxes.textContent = boxes;
    els.fFormula.textContent = basics.people + " × " + basics.mealsPerDay + " × " + basics.days + " = " + boxes;

    els.fItems.innerHTML = "";

    items.forEach(function(item){
      var totalCookedG = item.gramsPerMeal * boxes;
      var rawG;
      var ratioLabel, ratioValue, ratioTipKey;

      if (item.category === "carb"){
        rawG = totalCookedG / item.factor;
        ratioLabel = "Expansion factor";
        ratioTipKey = "expansionFactor";
        ratioValue = "×" + item.factor.toFixed(2) + (item.usedCustom ? " (custom)" : "");
      } else {
        rawG = totalCookedG / item.yield;
        ratioLabel = "Cooking yield";
        ratioTipKey = "cookingYield";
        ratioValue = Math.round(item.yield * 100) + "%" + (item.usedCustom ? " (custom)" : "");
      }

      var rawKg = rawG / 1000;
      var rawLb = rawKg * KG_TO_LB;

      var dotClass = "dot--" + item.category;
      var methodText = item.category === "protein" ? METHOD_LABELS[item.method] : (item.category === "carb" ? "Cooked & drained" : "Cooked");

      var block = document.createElement("div");
      block.className = "facts-item";
      var html = "";
      html += '<div class="facts-item__head">';
      html += '<span class="dot ' + dotClass + '"></span>';
      html += '<span class="facts-item__name">' + item.label + '</span>';
      html += '<span class="facts-item__method">' + methodText + '</span>';
      html += '</div>';
      html += '<div class="facts-item__grid">';
      html += statBlock("Cooked / meal", fmtG(item.gramsPerMeal), false, "cookedTarget");
      html += statBlock("Total cooked (batch)", fmtG(totalCookedG), false, "totalMeals");
      html += statBlock(ratioLabel, ratioValue, false, ratioTipKey);
      html += statBlock("Raw needed", fmtG(rawG) + " · " + rawKg.toFixed(2) + " kg · " + rawLb.toFixed(2) + " lb", true, "rawNeeded");
      html += '</div>';
      block.innerHTML = html;
      els.fItems.appendChild(block);
    });

    els.results.hidden = false;
    els.results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function statBlock(label, value, isRaw, tipKey){
    var icon = tipKey ? '<button class="info-icon' + (isRaw ? ' info-icon--light' : '') + '" type="button" data-tip-key="' + tipKey + '" aria-label="What does this mean?">i</button>' : "";
    return '<div class="facts-stat' + (isRaw ? " facts-stat--raw" : "") + '">' +
      '<span class="facts-stat__label">' + label + icon + '</span>' +
      '<span class="facts-stat__value">' + value + '</span>' +
      '</div>';
  }

  function fmtG(g){
    return Math.round(g).toLocaleString() + " g";
  }

  /* ============================================================
     PART 1 — BMR / TDEE / DAILY MACRO TARGETS
     ============================================================ */
  function buildProteinFoodSelect(){
    Object.keys(FOOD_DB.protein).forEach(function(key){
      var opt = document.createElement("option");
      opt.value = key;
      opt.textContent = FOOD_DB.protein[key].label;
      els.proteinFoodSelect.appendChild(opt);
    });
    els.proteinDensityInput.value = FOOD_DB.protein[els.proteinFoodSelect.value].proteinPer100g;

    Object.keys(FOOD_DB.carb).forEach(function(key){
      var opt = document.createElement("option");
      opt.value = key;
      opt.textContent = FOOD_DB.carb[key].label;
      els.carbFoodSelect.appendChild(opt);
    });
    els.carbDensityInput.value = FOOD_DB.carb[els.carbFoodSelect.value].carbsPer100g;

    Object.keys(FOOD_DB.veg).forEach(function(key){
      var opt = document.createElement("option");
      opt.value = key;
      opt.textContent = FOOD_DB.veg[key].label;
      els.vegFoodSelect.appendChild(opt);
    });
    els.fiberDensityInput.value = FOOD_DB.veg[els.vegFoodSelect.value].fiberPer100g;

    Object.keys(FOOD_DB.fat).forEach(function(key){
      var opt = document.createElement("option");
      opt.value = key;
      opt.textContent = FOOD_DB.fat[key].label;
      els.fatFoodSelect.appendChild(opt);
    });
    els.fatDensityInput.value = FOOD_DB.fat[els.fatFoodSelect.value].fatPer100g;
  }

  function toKg(value, unit){ return unit === "lb" ? value * LB_TO_KG : value; }
  function toCm(value, unit){ return unit === "in" ? value * IN_TO_CM : value; }

  function getBodyWeightKg(){
    var w = parseFloat(els.bodyWeight.value);
    if (!(w > 0)) return null;
    return toKg(w, els.bodyWeightUnit.value);
  }

  /* Height is the single field most likely to be mis-entered (typing "5.11"
     meaning 5'11" into a plain-inches box silently produces a tiny, wrong
     centimeter figure). We support three explicit modes so the conversion
     is never ambiguous:
       cm    — used as-is
       in    — total inches, converted directly to cm
       ftin  — separate feet + inches fields, combined then converted
     heightCm = (feet*12 + inches) * 2.54                                  */
  function getHeightCm(){
    var unit = els.heightUnit.value;
    if (unit === "ftin"){
      var ft = parseFloat(els.heightFeet.value);
      var inch = parseFloat(els.heightInches.value);
      if (!(ft >= 0)) ft = 0;
      if (!(inch >= 0)) inch = 0;
      if (ft <= 0 && inch <= 0) return NaN;
      return (ft * 12 + inch) * IN_TO_CM;
    }
    var v = parseFloat(els.height.value);
    if (!(v > 0)) return NaN;
    return toCm(v, unit);
  }

  function bmiCategory(bmi){
    if (bmi < 18.5) return "Underweight";
    if (bmi < 25) return "Healthy";
    if (bmi < 30) return "Overweight";
    return "Obese";
  }

  function bodyFatCategory(sex, bfPercent){
    var table = BODY_FAT_CATEGORIES[sex] || BODY_FAT_CATEGORIES.male;
    for (var i = 0; i < table.length; i++){
      if (bfPercent >= table[i][1] && bfPercent <= table[i][2]) return table[i][0];
    }
    return "—";
  }

  /* Protein rules (ISSN / ACSM-style planning table):
     which BODY WEIGHT the g/kg factor is applied to depends on the goal,
     and the FACTOR itself depends on goal + how active the person is —
     never a single flat number for everyone. */
  function getProteinTarget(goal, kg, targetKg, activityFactor){
    var basisKg, basisLabel, factor, factorLabel;

    if (goal === "cut"){
      var floor = kg * 0.85;
      basisKg = (targetKg > 0) ? Math.max(targetKg, floor) : floor;
      basisLabel = (targetKg > 0) ? "max(target weight, current weight × 0.85)" : "current weight × 0.85 (no target weight set)";
      factor = (activityFactor >= 1.725) ? 2.2 : 2.0; // 1.8–2.2 g/kg range; higher end for very active/athletes
      factorLabel = (activityFactor >= 1.725) ? "2.2 g/kg (cut, very active/athlete)" : "2.0 g/kg (cut, general)";
    } else if (goal === "leanbulk"){
      basisKg = (targetKg > 0) ? targetKg : kg;
      basisLabel = (targetKg > 0) ? "target weight" : "current weight (no target weight set)";
      factor = 1.8; // muscle-gain range 1.8–2.0, conservative end for a slow lean bulk
      factorLabel = "1.8 g/kg (lean bulk / muscle gain)";
    } else if (goal === "bulk"){
      basisKg = (targetKg > 0) ? targetKg : kg;
      basisLabel = (targetKg > 0) ? "target weight" : "current weight (no target weight set)";
      factor = (activityFactor >= 1.725) ? 2.2 : 2.0; // strength athlete 2.2, else muscle gain 2.0
      factorLabel = (activityFactor >= 1.725) ? "2.2 g/kg (bulk, strength athlete)" : "2.0 g/kg (bulk, muscle gain)";
    } else { // maintain
      basisKg = kg;
      basisLabel = "current weight";
      if (activityFactor <= 1.2){ factor = 1.0; factorLabel = "1.0 g/kg (sedentary)"; }
      else if (activityFactor <= 1.375){ factor = 1.4; factorLabel = "1.4 g/kg (general fitness)"; }
      else { factor = 1.6; factorLabel = "1.6 g/kg (maintenance, active)"; }
    }

    return { grams: basisKg * factor, basisKg: basisKg, basisLabel: basisLabel, factor: factor, factorLabel: factorLabel };
  }

  /* Fat: never let a % of calories method alone produce something silly
     like 36 g of fat for a 92 kg person. Calculate both an evidence-based
     %-of-calories figure AND a g/kg-of-bodyweight floor, and use whichever
     is higher — that's what keeps essential-fat and hormonal-health needs
     covered even at very low calorie targets. */
  function getFatTarget(calories, kg, fatPercentInput){
    var pct = (fatPercentInput >= 20 && fatPercentInput <= 30) ? fatPercentInput : 25;
    var byPercent = (calories * (pct / 100)) / 9;
    var byWeight = kg * 0.8; // midpoint of the 0.6–1.0 g/kg evidence-based range
    var grams = Math.max(byPercent, byWeight);
    var methodUsed = (byWeight > byPercent) ? "g/kg floor" : "% of calories";
    return { grams: grams, percentUsed: pct, byPercent: byPercent, byWeight: byWeight, methodUsed: methodUsed };
  }

  function getFiberTarget(calories){
    var raw = (calories / 1000) * 14;
    return Math.min(Math.max(raw, 25), 45);
  }

  function getWaterMl(kg, activityFactor){
    var mlPerKg = activityFactor >= 1.9 ? 40 : activityFactor >= 1.725 ? 38 : activityFactor >= 1.55 ? 36 : 35;
    return kg * mlPerKg;
  }

  /* Computes BMR, TDEE, goal calories, and the full macro/fiber/body-comp
     split. Returns null if required inputs (weight, height, age) are
     missing. */
  function getDailyTargets(){
    var kg = getBodyWeightKg();
    var cm = getHeightCm();
    var age = parseFloat(els.age.value);
    var sex = els.sex.value;
    if (kg === null || !(cm > 0) || !(age > 0)) return null;

    // BMI is needed up front now, since it also feeds the body-fat estimate below.
    var bmiEarly = kg / Math.pow(cm / 100, 2);

    var bfPercentInput = parseFloat(els.bodyFatPercent.value);
    var hasManualBodyFat = bfPercentInput > 0 && bfPercentInput < 70;

    // Body fat % is either what the person typed in, or — if they left it
    // blank — a BMI/age/sex estimate (Deurenberg formula) so lean mass,
    // FFMI, body-fat category, and the target-weight suggestion below still
    // work without requiring a skinfold/DEXA/bioimpedance number.
    var effectiveBfPercent, bodyFatSource;
    if (hasManualBodyFat){
      effectiveBfPercent = bfPercentInput;
      bodyFatSource = "entered";
    } else {
      var estimatedBf = (1.20 * bmiEarly) + (0.23 * age) - (10.8 * (sex === "female" ? 0 : 1)) - 5.4;
      effectiveBfPercent = Math.min(Math.max(estimatedBf, 3), 60);
      bodyFatSource = "estimated";
    }

    var leanMassKg = kg * (1 - effectiveBfPercent / 100);

    var bmrMethod, bmr;
    if (hasManualBodyFat){
      bmr = 370 + (21.6 * leanMassKg);
      bmrMethod = "katchmcardle";
    } else {
      bmr = sex === "female"
        ? (10 * kg) + (6.25 * cm) - (5 * age) - 161
        : (10 * kg) + (6.25 * cm) - (5 * age) + 5;
      bmrMethod = "mifflin";
    }

    var activityFactor = parseFloat(els.activityLevel.value);
    var tdee = bmr * activityFactor;

    var goal = els.goalType.value;
    var paceFrac = parseFloat(els.weeklyRate.value); // 0 (low end) .. 1 (high end)
    if (!(paceFrac >= 0 && paceFrac <= 1)) paceFrac = 0.5;

    var range = GOAL_CALORIE_RANGE_PCT[goal] || GOAL_CALORIE_RANGE_PCT.maintain;
    var adjustPercent = range[0] + paceFrac * (range[1] - range[0]);

    var calories;
    if (goal === "cut"){
      calories = tdee * (1 - adjustPercent / 100);
    } else if (goal === "leanbulk" || goal === "bulk"){
      calories = tdee * (1 + adjustPercent / 100);
    } else {
      calories = tdee;
    }

    var minCalories = MIN_CALORIES[sex] || MIN_CALORIES.male;
    var caloriesBeforeFloor = calories;
    calories = Math.max(calories, 0);

    var targetRaw = parseFloat(els.targetWeight.value);
    var targetKg = (targetRaw > 0) ? toKg(targetRaw, els.bodyWeightUnit.value) : null;

    // Target body fat % -> suggested body weight, holding lean mass constant.
    var targetBfRaw = parseFloat(els.targetBodyFatPercent.value);
    var hasTargetBf = targetBfRaw > 0 && targetBfRaw < 70;
    var suggestedWeightKg = hasTargetBf ? (leanMassKg / (1 - targetBfRaw / 100)) : null;

    var proteinInfo = getProteinTarget(goal, kg, targetKg, activityFactor);
    var proteinG = proteinInfo.grams;

    var fatPercentInput = parseFloat(els.fatPercent.value);
    var fatInfo = getFatTarget(calories, kg, fatPercentInput);
    var fatG = fatInfo.grams;

    var remainingKcal = calories - (proteinG * 4) - (fatG * 9);
    var carbsG = Math.max(remainingKcal / 4, 0);
    var carbsDeficitWarning = remainingKcal < 0;

    var fiberG = getFiberTarget(calories);

    var bmi = bmiEarly;
    var heightM = cm / 100;
    var ffmi = leanMassKg / (heightM * heightM);
    var ffmiNormalized = ffmi + 6.1 * (1.8 - heightM);

    var waterMl = getWaterMl(kg, activityFactor);

    // Actual daily calorie delta vs TDEE, used for the weight-change projection
    var dailyDelta = tdee - calories; // positive = deficit, negative = surplus

    // Validation warnings (never silently produce impossible numbers)
    var warnings = [];
    if (caloriesBeforeFloor < minCalories){
      warnings.push("Your calculated target (" + Math.round(caloriesBeforeFloor) + " kcal) is below the " + minCalories + " kcal/day general safety floor for " + (sex === "female" ? "women" : "men") + ". Consider a smaller deficit or consulting a professional.");
    }
    if (bmi < 15 || bmi > 50){
      warnings.push("BMI of " + bmi.toFixed(1) + " is outside the typical 15–50 range this tool is designed for — double-check your height and weight.");
    }
    var proteinPerKg = proteinG / kg;
    if (proteinPerKg > 3){
      warnings.push("Protein target is " + proteinPerKg.toFixed(1) + " g/kg, above the commonly cited 3 g/kg ceiling — this is unlikely to add benefit and may be hard to sustain.");
    }
    if (carbsDeficitWarning){
      warnings.push("Protein + fat alone already exceed your calorie target, so carbs were floored at 0 g. Your calorie target may be too low for this protein/fat combination — consider raising calories or lowering the fat %.");
    }

    return {
      kg: kg, cm: cm, age: age, sex: sex,
      bodyFatPercent: effectiveBfPercent, bodyFatSource: bodyFatSource, leanMassKg: leanMassKg,
      bmrMethod: bmrMethod,
      bmr: bmr, tdee: tdee, activityFactor: activityFactor,
      goal: goal, paceFrac: paceFrac, adjustPercent: adjustPercent, range: range,
      dailyDelta: dailyDelta,
      calories: Math.max(calories, 0),
      targetKg: targetKg,
      targetBodyFatPercent: hasTargetBf ? targetBfRaw : null,
      suggestedWeightKg: suggestedWeightKg,
      protein: Math.max(proteinG, 0), proteinInfo: proteinInfo,
      fat: Math.max(fatG, 0), fatInfo: fatInfo,
      carbs: carbsG,
      fiber: fiberG,
      bmi: bmi, bmiCategory: bmiCategory(bmi),
      ffmi: ffmi, ffmiNormalized: ffmiNormalized,
      bodyFatCategoryLabel: bodyFatCategory(sex, effectiveBfPercent),
      waterMl: waterMl,
      mealsPerDay: (parseFloat(els.nutritionMealsPerDay.value) > 0) ? parseFloat(els.nutritionMealsPerDay.value) : 3,
      warnings: warnings
    };
  }

  function updateTdeePreview(){
    var t = getDailyTargets();
    if (t === null){
      els.proteinFormulaOut.hidden = true;
      els.tdeeResult.hidden = true;
      els.warningsBox.hidden = true;
      els.mealBreakdownResult.hidden = true;
      els.mealBreakdownEmpty.hidden = false;
      els.foodRecommendResult.hidden = true;
      els.foodRecommendEmpty.hidden = false;
      if (els.bodyFatHint) els.bodyFatHint.textContent = "";
      if (els.suggestedWeightReadout){
        els.suggestedWeightReadout.textContent = "Enter a target body fat % above";
        els.suggestedWeightReadout.classList.add("is-empty");
      }
      return;
    }

    els.proteinFormulaOut.hidden = true; // superseded by the results card below

    // ---- Body fat % + lean mass line (shown either way; BMR method depends on whether it was entered) ----
    var bfSourceNote = t.bodyFatSource === "estimated"
      ? "estimated from BMI, age &amp; sex — enter your real number above for Katch–McArdle accuracy"
      : "as entered";
    var bfLine = "Body fat % used = <strong>" + t.bodyFatPercent.toFixed(1) + "%</strong> <span class=\"formula-note\">(" + bfSourceNote + ")</span>";
    var leanMassLine = "Lean mass = weight × (1 − body fat%) = " + t.kg.toFixed(1) + " × (1 − " + t.bodyFatPercent.toFixed(1) + "%) = <strong>" + t.leanMassKg.toFixed(1) + " kg</strong>";

    var bmrFormula;
    if (t.bmrMethod === "katchmcardle"){
      bmrFormula =
        bfLine + "<br>" + leanMassLine + "<br>" +
        "BMR (Katch–McArdle) = 370 + 21.6 × lean mass = 370 + 21.6×" + t.leanMassKg.toFixed(1) + " = <strong>" + Math.round(t.bmr) + " kcal</strong>";
    } else {
      var sexLabel = t.sex === "female" ? "10×weight + 6.25×height − 5×age − 161" : "10×weight + 6.25×height − 5×age + 5";
      bmrFormula = t.sex === "female"
        ? "BMR (Mifflin–St Jeor) = 10×" + t.kg.toFixed(1) + " + 6.25×" + t.cm.toFixed(1) + " − 5×" + t.age.toFixed(0) + " − 161 = <strong>" + Math.round(t.bmr) + " kcal</strong>"
        : "BMR (Mifflin–St Jeor) = 10×" + t.kg.toFixed(1) + " + 6.25×" + t.cm.toFixed(1) + " − 5×" + t.age.toFixed(0) + " + 5 = <strong>" + Math.round(t.bmr) + " kcal</strong>";
      bmrFormula += " <span class=\"formula-note\">(" + sexLabel + ", height = " + t.cm.toFixed(1) + " cm)</span><br>" +
        bfLine + "<br>" + leanMassLine + " <span class=\"formula-note\">(used for FFMI, body-fat category &amp; suggested weight, not for BMR)</span>";
    }

    // ---- Goal calories: always a % of TDEE, never a flat kcal number ----
    var goalLine;
    if (t.goal === "cut"){
      goalLine = "Calories = TDEE × (1 − " + t.adjustPercent.toFixed(1) + "%) = " + Math.round(t.tdee) + " × " + (1 - t.adjustPercent/100).toFixed(3) +
        " = <strong>" + Math.round(t.calories) + " kcal/day</strong> <span class=\"formula-note\">(" + t.range[0] + "–" + t.range[1] + "% deficit range)</span>";
    } else if (t.goal === "leanbulk" || t.goal === "bulk"){
      goalLine = "Calories = TDEE × (1 + " + t.adjustPercent.toFixed(1) + "%) = " + Math.round(t.tdee) + " × " + (1 + t.adjustPercent/100).toFixed(3) +
        " = <strong>" + Math.round(t.calories) + " kcal/day</strong> <span class=\"formula-note\">(" + t.range[0] + "–" + t.range[1] + "% surplus range)</span>";
    } else {
      goalLine = "Calories = TDEE (maintenance, 0% adjustment) = <strong>" + Math.round(t.calories) + " kcal/day</strong>";
    }

    var pInfo = t.proteinInfo, fInfo = t.fatInfo;

    els.tdeeFormulaOut.innerHTML =
      bmrFormula + "<br>" +
      "TDEE = BMR × activity factor = " + Math.round(t.bmr) + " × " + t.activityFactor + " = <strong>" + Math.round(t.tdee) + " kcal</strong><br>" +
      goalLine + "<br>" +
      "Protein = " + pInfo.basisLabel + " × " + pInfo.factorLabel + " = " + pInfo.basisKg.toFixed(1) + " × " + pInfo.factor.toFixed(1) + " = <strong>" + Math.round(t.protein) + " g/day</strong><br>" +
      "Fat, method 1 (% of calories) = (" + Math.round(t.calories) + " × " + fInfo.percentUsed + "%) ÷ 9 = " + Math.round(fInfo.byPercent) + " g<br>" +
      "Fat, method 2 (g/kg bodyweight) = " + t.kg.toFixed(1) + " × 0.8 = " + Math.round(fInfo.byWeight) + " g<br>" +
      "Fat = higher of the two (" + fInfo.methodUsed + ") = <strong>" + Math.round(t.fat) + " g/day</strong><br>" +
      "Carbs = (calories − protein×4 − fat×9) ÷ 4 = <strong>" + Math.round(t.carbs) + " g/day</strong><br>" +
      "Fiber = 14 g per 1,000 kcal × " + (t.calories/1000).toFixed(2) + " (clamped 25–45 g) = <strong>" + Math.round(t.fiber) + " g/day</strong><br>" +
      "BMI = weight ÷ height² = " + t.kg.toFixed(1) + " ÷ " + (t.cm/100).toFixed(2) + "² = <strong>" + t.bmi.toFixed(1) + "</strong> (" + t.bmiCategory + ")<br>" +
      "Water = weight × ml/kg = " + t.kg.toFixed(1) + " × " + (t.waterMl/t.kg).toFixed(0) + " = <strong>" + (t.waterMl/1000).toFixed(1) + " L/day</strong>" +
      "<br>FFMI = lean mass ÷ height² = " + t.leanMassKg.toFixed(1) + " ÷ " + (t.cm/100).toFixed(2) + "² = <strong>" + t.ffmi.toFixed(1) + "</strong> (normalized " + t.ffmiNormalized.toFixed(1) + ")" +
      (t.suggestedWeightKg !== null
        ? ("<br>Suggested body weight = lean mass ÷ (1 − target body fat%) = " + t.leanMassKg.toFixed(1) + " ÷ (1 − " + t.targetBodyFatPercent.toFixed(1) + "%) = <strong>" + t.suggestedWeightKg.toFixed(1) + " kg</strong> (" + (t.suggestedWeightKg * KG_TO_LB).toFixed(1) + " lb)")
        : "");

    els.tCalories.textContent = Math.round(t.calories).toLocaleString() + " kcal";
    els.tProtein.textContent = Math.round(t.protein) + " g";
    els.tFat.textContent = Math.round(t.fat) + " g";
    els.tCarbs.textContent = Math.round(t.carbs) + " g";
    els.tFiber.textContent = Math.round(t.fiber) + " g";
    els.tBmrTdee.textContent = Math.round(t.bmr) + " / " + Math.round(t.tdee);
    els.tWater.textContent = (t.waterMl/1000).toFixed(1) + " L";
    els.tBmi.textContent = t.bmi.toFixed(1);
    els.tBmiCategory.textContent = t.bmiCategory;
    var bfEstimatedTag = t.bodyFatSource === "estimated" ? " (est.)" : "";
    els.tLbm.textContent = t.leanMassKg.toFixed(1) + " kg" + bfEstimatedTag;
    els.tFfmi.textContent = t.ffmi.toFixed(1) + bfEstimatedTag;
    els.tBfCategory.textContent = t.bodyFatCategoryLabel + bfEstimatedTag;

    // Body fat % input hint — tell the person we're estimating for them,
    // so they know the number driving lean mass/FFMI/suggested weight.
    if (els.bodyFatHint){
      els.bodyFatHint.textContent = t.bodyFatSource === "estimated"
        ? "Estimated ≈ " + t.bodyFatPercent.toFixed(1) + "% from your BMI, age & sex. Enter your real number for better accuracy."
        : "";
    }

    // Suggested body weight — inline readout next to the target body fat % input,
    // plus the same figure inside the Body Composition results card.
    var suggestedWeightText = t.suggestedWeightKg !== null
      ? t.suggestedWeightKg.toFixed(1) + " kg · " + (t.suggestedWeightKg * KG_TO_LB).toFixed(1) + " lb"
      : null;
    if (els.suggestedWeightReadout){
      els.suggestedWeightReadout.textContent = suggestedWeightText || "Enter a target body fat % above";
      els.suggestedWeightReadout.classList.toggle("is-empty", !suggestedWeightText);
    }
    els.tSuggestedWeight.textContent = suggestedWeightText || "Enter target body fat %";

    // ---- Warnings ----
    if (t.warnings.length){
      els.warningsBox.innerHTML = t.warnings.map(function(w){ return "<p>⚠ " + w + "</p>"; }).join("");
      els.warningsBox.hidden = false;
    } else {
      els.warningsBox.hidden = true;
    }

    // ---- Weight-goal projection (uses the ACTUAL calorie delta, not a hardcoded rate) ----
    if (t.targetKg !== null){
      var deltaKg = t.targetKg - t.kg;
      var direction = deltaKg < 0 ? "lose" : "gain";
      var mismatchNote = "";
      if ((t.goal === "cut" && deltaKg > 0) || ((t.goal === "bulk" || t.goal === "leanbulk") && deltaKg < 0)){
        mismatchNote = " Note: your goal setting and target weight point in opposite directions — double-check which one you meant.";
      }
      var weeklyChangeKg = Math.abs(t.dailyDelta) * 7 / KCAL_PER_KG_FAT;
      if (weeklyChangeKg > 0.001 && Math.abs(deltaKg) > 0.01){
        var weeks = Math.abs(deltaKg) / weeklyChangeKg;
        els.tdeeProjectionOut.textContent =
          "At this calorie target, reaching " + els.targetWeight.value + " " + els.bodyWeightUnit.value + " means you need to " + direction + " about " +
          Math.abs(deltaKg).toFixed(1) + " kg (" + (Math.abs(deltaKg) * KG_TO_LB).toFixed(1) + " lb), roughly " +
          Math.ceil(weeks) + " weeks away at ~" + weeklyChangeKg.toFixed(2) + " kg/week." + mismatchNote;
      } else if (Math.abs(deltaKg) <= 0.01){
        els.tdeeProjectionOut.textContent = "You're already at your target weight (or very close to it).";
      } else {
        els.tdeeProjectionOut.textContent = "Calories are at maintenance, so no weight-change rate applies. Choose a cut, lean bulk, or bulk goal to see a timeline." + mismatchNote;
      }
    } else {
      els.tdeeProjectionOut.textContent = "";
    }

    els.tdeeResult.hidden = false;

    renderMealBreakdown(t);
    renderFoodRecommendation(t);
  }

  /* ============================================================
     PART 1B — MEAL-BY-MEAL BREAKDOWN
     ============================================================ */
  function renderMealBreakdown(t){
    var meals = t.mealsPerDay;
    if (!(meals > 0)){
      els.mealBreakdownResult.hidden = true;
      els.mealBreakdownEmpty.hidden = false;
      return;
    }
    var rows = [
      { label: "Calories", value: t.calories, unit: "kcal" },
      { label: "Protein", value: t.protein, unit: "g" },
      { label: "Fat", value: t.fat, unit: "g" },
      { label: "Carbs", value: t.carbs, unit: "g" },
      { label: "Fiber", value: t.fiber, unit: "g" }
    ];
    var html = '<div class="mb-row mb-row--head"><span>Per meal (÷' + meals + ')</span><span>Per day</span></div>';
    rows.forEach(function(r){
      var perMeal = r.value / meals;
      html += '<div class="mb-row"><span><strong>' + r.label + ':</strong> ' +
        (r.unit === "kcal" ? Math.round(perMeal).toLocaleString() : perMeal.toFixed(1)) + ' ' + r.unit +
        '</span><span class="mb-row__day">' + (r.unit === "kcal" ? Math.round(r.value).toLocaleString() : Math.round(r.value)) + ' ' + r.unit + '/day</span></div>';
    });
    els.mealBreakdownGrid.innerHTML = html;
    els.mealBreakdownResult.hidden = false;
    els.mealBreakdownEmpty.hidden = true;
  }

  /* ============================================================
     PART 1C — FULL-DAY FOOD RECOMMENDATION (works backward from
     the daily protein / carb / fiber targets to cooked + raw
     shopping weights, using the foods picked in Part 2 below)
     ============================================================ */
  function renderFoodRecommendation(t){
    if (!els.proteinFoodSelect || !els.proteinFoodSelect.value){
      els.foodRecommendResult.hidden = true;
      els.foodRecommendEmpty.hidden = false;
      return;
    }

    var proteinKey = els.proteinFoodSelect.value;
    var carbKey = els.carbFoodSelect.value;
    var vegKey = els.vegFoodSelect.value;
    var pFood = FOOD_DB.protein[proteinKey];
    var cFood = FOOD_DB.carb[carbKey];
    var vFood = FOOD_DB.veg[vegKey];

    var proteinDensity = parseFloat(els.proteinDensityInput.value) || pFood.proteinPer100g;
    var carbDensity = parseFloat(els.carbDensityInput.value) || cFood.carbsPer100g;
    var fiberDensity = parseFloat(els.fiberDensityInput.value) || vFood.fiberPer100g;

    // Use the currently-selected cooking method for protein if the meal-prep
    // list has this exact food checked; otherwise default to "baked".
    var proteinMethod = "baked";
    var checkedProtein = document.querySelector('.food-item[data-category="protein"][data-key="' + proteinKey + '"].is-checked');
    if (checkedProtein){
      proteinMethod = checkedProtein.querySelector('[data-role="method"]').value;
    }
    var proteinYield = pFood.methods[proteinMethod];
    var carbFactor = cFood.factor;
    var vegYield = vFood.yield;

    var proteinCookedG = (t.protein / proteinDensity) * 100;
    var proteinRawG = proteinCookedG / proteinYield;

    var carbCookedG = (t.carbs / carbDensity) * 100;
    var carbRawG = carbCookedG / carbFactor;

    var fiberGapG = t.fiber; // whole day's fiber target, none consumed yet in this simple model
    var vegCookedG = (fiberGapG / fiberDensity) * 100;
    var vegRawG = vegCookedG / vegYield;

    els.foodRecommendFormula.innerHTML =
      pFood.label + " (protein): (" + Math.round(t.protein) + "g protein ÷ " + proteinDensity + ") × 100 = <strong>" + Math.round(proteinCookedG) + " g cooked</strong>, ÷ " + proteinYield.toFixed(2) + " yield (" + METHOD_LABELS[proteinMethod] + ") = <strong>" + Math.round(proteinRawG) + " g raw</strong><br>" +
      cFood.label + " (carbs): (" + Math.round(t.carbs) + "g carbs ÷ " + carbDensity + ") × 100 = <strong>" + Math.round(carbCookedG) + " g cooked</strong>, ÷ " + carbFactor.toFixed(2) + " expansion = <strong>" + Math.round(carbRawG) + " g dry</strong><br>" +
      vFood.label + " (fiber): (" + Math.round(t.fiber) + "g fiber ÷ " + fiberDensity + ") × 100 = <strong>" + Math.round(vegCookedG) + " g cooked</strong>, ÷ " + vegYield.toFixed(2) + " yield = <strong>" + Math.round(vegRawG) + " g raw</strong>";

    var html = "";
    html += '<div class="facts-item"><div class="facts-item__head"><span class="dot dot--protein"></span><span class="facts-item__name">' + pFood.label + '</span></div><div class="facts-item__grid facts-item__grid--3">' +
      '<div class="facts-stat"><span class="facts-stat__label">Cooked needed/day</span><span class="facts-stat__value">' + Math.round(proteinCookedG) + ' g</span></div>' +
      '<div class="facts-stat facts-stat--raw"><span class="facts-stat__label">Raw to buy</span><span class="facts-stat__value">' + Math.round(proteinRawG) + ' g</span></div>' +
      '<div class="facts-stat"><span class="facts-stat__label">Method</span><span class="facts-stat__value">' + METHOD_LABELS[proteinMethod] + '</span></div>' +
      '</div></div>';
    html += '<div class="facts-item"><div class="facts-item__head"><span class="dot dot--carb"></span><span class="facts-item__name">' + cFood.label + '</span></div><div class="facts-item__grid facts-item__grid--3">' +
      '<div class="facts-stat"><span class="facts-stat__label">Cooked needed/day</span><span class="facts-stat__value">' + Math.round(carbCookedG) + ' g</span></div>' +
      '<div class="facts-stat facts-stat--raw"><span class="facts-stat__label">Dry to buy</span><span class="facts-stat__value">' + Math.round(carbRawG) + ' g</span></div>' +
      '<div class="facts-stat"><span class="facts-stat__label">Expansion factor</span><span class="facts-stat__value">×' + carbFactor.toFixed(2) + '</span></div>' +
      '</div></div>';
    html += '<div class="facts-item"><div class="facts-item__head"><span class="dot dot--veg"></span><span class="facts-item__name">' + vFood.label + ' (fiber target)</span></div><div class="facts-item__grid facts-item__grid--3">' +
      '<div class="facts-stat"><span class="facts-stat__label">Cooked needed/day</span><span class="facts-stat__value">' + Math.round(vegCookedG) + ' g</span></div>' +
      '<div class="facts-stat facts-stat--raw"><span class="facts-stat__label">Raw to buy</span><span class="facts-stat__value">' + Math.round(vegRawG) + ' g</span></div>' +
      '<div class="facts-stat"><span class="facts-stat__label">Cooking yield</span><span class="facts-stat__value">' + Math.round(vegYield*100) + '%</span></div>' +
      '</div></div>';

    els.foodRecommendGrid.innerHTML = html;
    els.foodRecommendResult.hidden = false;
    els.foodRecommendEmpty.hidden = true;
  }

  function syncFromCalculator(){
    var syncedAny = false;

    var checkedProtein = document.querySelector('.food-item[data-category="protein"].is-checked');
    if (checkedProtein){
      var pKey = checkedProtein.dataset.key;
      var pGrams = checkedProtein.querySelector('[data-role="grams"]').value;
      els.proteinFoodSelect.value = pKey;
      els.proteinDensityInput.value = FOOD_DB.protein[pKey].proteinPer100g;
      if (pGrams) els.proteinMealGrams.value = pGrams;
      syncedAny = true;
    }

    var checkedCarb = document.querySelector('.food-item[data-category="carb"].is-checked');
    if (checkedCarb){
      var cKey = checkedCarb.dataset.key;
      var cGrams = checkedCarb.querySelector('[data-role="grams"]').value;
      els.carbFoodSelect.value = cKey;
      els.carbDensityInput.value = FOOD_DB.carb[cKey].carbsPer100g;
      if (cGrams) els.carbMealGrams.value = cGrams;
      syncedAny = true;
    }

    var checkedVeg = document.querySelector('.food-item[data-category="veg"].is-checked');
    if (checkedVeg){
      var vKey = checkedVeg.dataset.key;
      var vGrams = checkedVeg.querySelector('[data-role="grams"]').value;
      els.vegFoodSelect.value = vKey;
      els.fiberDensityInput.value = FOOD_DB.veg[vKey].fiberPer100g;
      if (vGrams) els.vegMealGrams.value = vGrams;
      syncedAny = true;
    }

    if (!syncedAny){
      alert("No items are checked in the Meal Prep tab yet. Check a protein, carb, or veggie there first, then come back and sync.");
    }
  }

  /* ============================================================
     PART 2 — PER-MEAL COVERAGE + VEG AUTO-SUGGESTION
     ============================================================ */
  function handleProteinCalculate(){
    var t = getDailyTargets();
    if (t === null){
      alert("Fill in your sex, age, height, and body weight in Part 1 first — the daily targets are needed to show coverage percentages.");
      return;
    }

    var proteinMealGrams = parseFloat(els.proteinMealGrams.value);
    var proteinDensity = parseFloat(els.proteinDensityInput.value);
    var carbMealGrams = parseFloat(els.carbMealGrams.value);
    var carbDensity = parseFloat(els.carbDensityInput.value);
    var vegMealGrams = parseFloat(els.vegMealGrams.value);
    var fiberDensity = parseFloat(els.fiberDensityInput.value);
    var fatMealGrams = parseFloat(els.fatMealGrams.value);
    var fatDensity = parseFloat(els.fatDensityInput.value);

    var hasProtein = proteinMealGrams > 0 && proteinDensity > 0;
    var hasCarb = carbMealGrams > 0 && carbDensity > 0;
    var hasVeg = vegMealGrams > 0 && fiberDensity > 0;
    var hasFat = fatMealGrams > 0 && fatDensity > 0;

    if (!hasProtein && !hasCarb && !hasVeg && !hasFat){
      alert("Enter grams per meal for at least one of protein, carbs, veggies, or fats.");
      return;
    }

    updateTdeePreview();

    var proteinKey = els.proteinFoodSelect.value;
    var carbKey = els.carbFoodSelect.value;
    var vegKey = els.vegFoodSelect.value;
    var fatKey = els.fatFoodSelect.value;

    var totalProtein = 0, totalFat = 0, totalCarbs = 0, totalFiber = 0, totalKcal = 0;
    var formulaHtml = "";

    if (hasProtein){
      var pFood = FOOD_DB.protein[proteinKey];
      var pProtein = (proteinMealGrams / 100) * proteinDensity;
      var pFat = (proteinMealGrams / 100) * pFood.fatPer100g;
      var pKcal = (proteinMealGrams / 100) * pFood.kcalPer100g;
      totalProtein += pProtein; totalFat += pFat; totalKcal += pKcal;
      formulaHtml += pFood.label + ": (" + proteinMealGrams + "g ÷ 100) × " + proteinDensity + " protein = <strong>" + pProtein.toFixed(1) + " g protein</strong>, ~" + Math.round(pFat) + " g fat, ~" + Math.round(pKcal) + " kcal<br>";
    }
    if (hasCarb){
      var cFood = FOOD_DB.carb[carbKey];
      var cCarbs = (carbMealGrams / 100) * carbDensity;
      var cProtein = (carbMealGrams / 100) * cFood.proteinPer100g;
      var cFat = (carbMealGrams / 100) * cFood.fatPer100g;
      var cFiber = (carbMealGrams / 100) * cFood.fiberPer100g;
      var cKcal = (carbMealGrams / 100) * cFood.kcalPer100g;
      totalCarbs += cCarbs; totalProtein += cProtein; totalFat += cFat; totalFiber += cFiber; totalKcal += cKcal;
      formulaHtml += cFood.label + ": (" + carbMealGrams + "g ÷ 100) × " + carbDensity + " carbs = <strong>" + cCarbs.toFixed(1) + " g carbs</strong>, ~" + Math.round(cKcal) + " kcal<br>";
    }
    if (hasVeg){
      var vFood = FOOD_DB.veg[vegKey];
      var vFiber = (vegMealGrams / 100) * fiberDensity;
      var vProtein = (vegMealGrams / 100) * vFood.proteinPer100g;
      var vCarbs = (vegMealGrams / 100) * vFood.carbsPer100g;
      var vFat = (vegMealGrams / 100) * vFood.fatPer100g;
      var vKcal = (vegMealGrams / 100) * vFood.kcalPer100g;
      totalFiber += vFiber; totalProtein += vProtein; totalCarbs += vCarbs; totalFat += vFat; totalKcal += vKcal;
      formulaHtml += vFood.label + ": (" + vegMealGrams + "g ÷ 100) × " + fiberDensity + " fiber = <strong>" + vFiber.toFixed(1) + " g fiber</strong>, ~" + Math.round(vKcal) + " kcal<br>";
    }
    if (hasFat){
      var fFood = FOOD_DB.fat[fatKey];
      var fFat = (fatMealGrams / 100) * fatDensity;
      var fProtein = (fatMealGrams / 100) * fFood.proteinPer100g;
      var fCarbs = (fatMealGrams / 100) * fFood.carbsPer100g;
      var fFiber = (fatMealGrams / 100) * fFood.fiberPer100g;
      var fKcal = (fatMealGrams / 100) * fFood.kcalPer100g;
      totalFat += fFat; totalProtein += fProtein; totalCarbs += fCarbs; totalFiber += fFiber; totalKcal += fKcal;
      formulaHtml += fFood.label + ": (" + fatMealGrams + "g ÷ 100) × " + fatDensity + " fat = <strong>" + fFat.toFixed(1) + " g fat</strong>, ~" + Math.round(fKcal) + " kcal<br>";
    }

    els.proteinFormula2Out.innerHTML = formulaHtml;

    els.pCaloriesPerMeal.textContent = Math.round(totalKcal).toLocaleString() + " kcal";
    els.pProteinPerMeal.textContent = totalProtein.toFixed(1) + " g";
    els.pFatPerMeal.textContent = totalFat.toFixed(1) + " g";
    els.pCarbsPerMeal.textContent = totalCarbs.toFixed(1) + " g";
    els.pFiberPerMeal.textContent = totalFiber.toFixed(1) + " g";

    els.pCaloriesPercentDaily.textContent = pct(totalKcal, t.calories);
    els.pPercentDaily.textContent = pct(totalProtein, t.protein);
    els.pFatPercentDaily.textContent = pct(totalFat, t.fat);
    els.pCarbsPercentDaily.textContent = pct(totalCarbs, t.carbs);
    els.pFiberPercentDaily.textContent = pct(totalFiber, t.fiber);

    renderVegSuggestion(t, totalFiber);

    els.proteinResult.hidden = false;
    els.mealExportWrap.hidden = false;
    els.proteinResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function pct(value, target){
    if (!(target > 0)) return "—";
    return Math.round((value / target) * 100) + "%";
  }

  /* Shows, for each veg in the rotation, how much of THAT veg alone
     would close the remaining daily fiber gap — framed as independent
     options rather than a combined total, since fiber density varies
     a lot between them (cucumber is mostly water). */
  function renderVegSuggestion(targets, mealFiberSoFar){
    var gap = targets.fiber - mealFiberSoFar;
    if (!(gap > 0.5)){
      els.vegSuggest.hidden = true;
      els.vegSuggestGrid.innerHTML = "";
      return;
    }

    els.vegSuggestIntro.textContent =
      "This meal leaves about " + gap.toFixed(1) + " g of fiber short of your " + Math.round(targets.fiber) +
      " g/day target. Any ONE of these amounts (added across the rest of your day) would close that gap on its own — mix and match to taste:";

    var html = "";
    VEG_SUGGEST_ORDER.forEach(function(key){
      var food = FOOD_DB.veg[key];
      var gramsNeeded = (gap / food.fiberPer100g) * 100;
      var display = gramsNeeded >= 1000
        ? (gramsNeeded / 1000).toFixed(1) + " kg"
        : Math.round(gramsNeeded) + " g";
      html += '<div class="facts-stat">' +
        '<span class="facts-stat__label">' + food.label + '</span>' +
        '<span class="facts-stat__value">' + display + '</span>' +
        '</div>';
    });
    els.vegSuggestGrid.innerHTML = html;
    els.vegSuggest.hidden = false;
  }

  /* ============================================================
     RESET
     ============================================================ */
  function handleReset(){
    els.people.value = "";
    els.mealsPerDay.value = "";
    els.days.value = "";
    clearError(els.errPeople); clearError(els.errMealsPerDay); clearError(els.errDays); clearError(els.errFoods);

    document.querySelectorAll(".food-item").forEach(function(el){
      el.classList.remove("is-checked");
      var checkbox = el.querySelector('[data-role="toggle"]');
      checkbox.checked = false;
      el.querySelectorAll("input, select").forEach(function(input){
        if (input.type === "checkbox") return;
        if (input.tagName === "SELECT") { input.selectedIndex = 0; return; }
        input.value = "";
        input.classList.remove("is-invalid");
      });
    });

    els.results.hidden = true;
    els.fItems.innerHTML = "";
    updateLiveScale();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ============================================================
     EXPORT AS PNG (shared by both tabs)
     ============================================================ */
  function exportCardAsPng(cardEl, filename, triggerBtn){
    if (typeof html2canvas === "undefined"){
      alert("Export library failed to load. Check your internet connection and try again.");
      return;
    }
    triggerBtn.disabled = true;
    var originalText = triggerBtn.textContent;
    triggerBtn.textContent = "Preparing image…";

    html2canvas(cardEl, { backgroundColor: "#ffffff", scale: 2 }).then(function(canvas){
      var link = document.createElement("a");
      link.download = filename;
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }).catch(function(){
      alert("Could not export the image. Please try again.");
    }).finally(function(){
      triggerBtn.disabled = false;
      triggerBtn.textContent = originalText;
    });
  }

})();
