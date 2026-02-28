import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Snack', 'Dinner']

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(dateStr) {
  const today = localToday()
  if (dateStr === today) return 'Today'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function offsetDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function MacroBar({ label, value, goal, color }) {
  const pct = Math.min(100, (value / goal) * 100)
  const over = value > goal
  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-slate-500">{label}</span>
        <span className={`text-xs font-bold ${over ? 'text-red-600' : 'text-slate-700'}`}>{value}g</span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-500' : color}`}
          style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-slate-400 mt-0.5">{goal}g</div>
    </div>
  )
}

export default function Dashboard() {
  const { signOut } = useAuth()
  const [currentDate, setCurrentDate] = useState(localToday())
  const [summary, setSummary] = useState(null)
  const [profile, setProfile] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [goalEdits, setGoalEdits] = useState({})
  const [savingGoals, setSavingGoals] = useState(false)
  const [recipes, setRecipes] = useState([])
  const [showRecipeBuilder, setShowRecipeBuilder] = useState(false)
  const [showRecipePicker, setShowRecipePicker] = useState(false)
  const [activeRecipe, setActiveRecipe] = useState(null)
  const [recipeName, setRecipeName] = useState('')
  const [recipeIngredients, setRecipeIngredients] = useState([])
  const [recipeQuery, setRecipeQuery] = useState('')
  const [recipeSearchResults, setRecipeSearchResults] = useState([])
  const [recipeSearching, setRecipeSearching] = useState(false)
  const [recipeGrams, setRecipeGrams] = useState('100')
  const [recipeError, setRecipeError] = useState('')
  const [builderName, setBuilderName] = useState('')
  const [logModal, setLogModal] = useState(null)
  const [editingPortion, setEditingPortion] = useState(null)

  const today = localToday()
  const isToday = currentDate === today

  const loadRecipes = useCallback(async () => {
    try {
      const data = await api.getRecipes()
      setRecipes(data)
    } catch (_) {}
  }, [])

  useEffect(() => { loadRecipes() }, [loadRecipes])

  const loadDay = useCallback(async (date) => {
    setLoading(true)
    setError('')
    try {
      const [dayData, profileData, histData] = await Promise.all([
        api.getDay(date),
        api.getProfile(),
        api.getHistory(7),
      ])
      setSummary(dayData)
      setProfile(profileData)
      setHistory(histData.filter(h => h.date !== date))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDay(currentDate) }, [currentDate, loadDay])

  useEffect(() => {
    if (profile) {
      setGoalEdits({
        calorie_goal: profile.calorie_goal,
        protein_goal: profile.protein_goal,
        carbs_goal: profile.carbs_goal,
        fat_goal: profile.fat_goal,
        fiber_goal: profile.fiber_goal,
      })
    }
  }, [profile])

  async function handleCreateRecipe(e) {
    e.preventDefault()
    if (!recipeName.trim()) return
    try {
      const recipe = await api.createRecipe({ name: recipeName.trim() })
      setActiveRecipe(recipe)
      setBuilderName(recipe.name)
      setRecipeIngredients(recipe.ingredients)
      setRecipeName('')
    } catch (err) {
      setRecipeError(err.message)
    }
  }

  function handleEditRecipe(recipe) {
    setActiveRecipe(recipe)
    setBuilderName(recipe.name)
    setRecipeIngredients(recipe.ingredients)
    setShowRecipeBuilder(true)
  }

  async function handleRenameRecipe() {
    if (!activeRecipe || !builderName.trim() || builderName.trim() === activeRecipe.name) return
    try {
      const updated = await api.updateRecipe(activeRecipe.id, { name: builderName.trim() })
      setActiveRecipe(updated)
    } catch (err) {
      setRecipeError(err.message)
    }
  }

  async function handleRecipeSearch() {
    if (!recipeQuery.trim()) return
    setRecipeSearching(true)
    setRecipeSearchResults([])
    try {
      const results = await api.searchFoods(recipeQuery.trim())
      setRecipeSearchResults(results)
    } catch (err) {
      setRecipeError(err.message)
    } finally {
      setRecipeSearching(false)
    }
  }

  async function handleAddRecipeIngredient(food) {
    if (!activeRecipe) return
    setRecipeSearchResults([])
    setRecipeQuery('')
    const g = parseFloat(recipeGrams) || 100
    const ingredient = {
      food_name: food.name,
      quantity: g,
      unit: 'g',
      usda_fdc_id: food.fdc_id,
      calories_per_unit: food.calories_per_100g / 100,
      protein_per_unit: food.protein_per_100g / 100,
      carbs_per_unit: food.carbs_per_100g / 100,
      fat_per_unit: food.fat_per_100g / 100,
      fiber_per_unit: food.fiber_per_100g / 100,
    }
    try {
      const added = await api.addIngredient(activeRecipe.id, ingredient)
      setRecipeIngredients(prev => [...prev, added])
      setRecipeGrams('100')
    } catch (err) {
      setRecipeError(err.message)
    }
  }

  async function handleRemoveIngredient(ingredientId) {
    if (!activeRecipe) return
    try {
      await api.removeIngredient(activeRecipe.id, ingredientId)
      setRecipeIngredients(prev => prev.filter(i => i.id !== ingredientId))
    } catch (err) {
      setRecipeError(err.message)
    }
  }

  function handleDoneBuilding() {
    setShowRecipeBuilder(false)
    setActiveRecipe(null)
    setRecipeIngredients([])
    setRecipeQuery('')
    setRecipeSearchResults([])
    setRecipeGrams('100')
    setRecipeError('')
    loadRecipes()
  }

  async function handleDeleteRecipe(id) {
    try {
      await api.deleteRecipe(id)
      setRecipes(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  function openTemplate(recipeId) {
    const recipe = recipes.find(r => r.id === recipeId)
    if (!recipe) return
    setShowRecipePicker(false)
    setShowRecipeBuilder(false)
    openLogModal(recipe)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openLogModal(recipe) {
    const checked = new Set(recipe.ingredients.filter(i => i.checked).map(i => i.id))
    const quantities = {}
    recipe.ingredients.forEach(i => { quantities[i.id] = String(i.quantity) })
    const rawTotal = String(recipe.ingredients.filter(i => i.checked).reduce((s, i) => s + i.quantity, 0))
    const cookedDefault = recipe.last_cooked_weight != null ? String(recipe.last_cooked_weight) : rawTotal
    setLogModal({
      recipe,
      checked,
      quantities,
      totalCookedWeight: cookedDefault,
      portionWeight: cookedDefault,
      mealType: recipe.last_meal_type ?? 'Breakfast',
      loggedDate: currentDate,
      error: '',
    })
  }

  function logModalMacros() {
    if (!logModal) return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    let calories = 0, protein = 0, carbs = 0, fat = 0, fiber = 0
    for (const ing of logModal.recipe.ingredients) {
      if (!logModal.checked.has(ing.id)) continue
      const qty = parseFloat(logModal.quantities[ing.id]) || 0
      calories += qty * ing.calories_per_unit
      protein += qty * ing.protein_per_unit
      carbs += qty * ing.carbs_per_unit
      fat += qty * ing.fat_per_unit
      fiber += qty * ing.fiber_per_unit
    }
    const total = parseFloat(logModal.totalCookedWeight) || 0
    const portion = parseFloat(logModal.portionWeight) || 0
    const scale = (total > 0 && portion > 0) ? portion / total : 1.0
    return {
      calories: Math.round(calories * scale),
      protein: Math.round(protein * scale * 10) / 10,
      carbs: Math.round(carbs * scale * 10) / 10,
      fat: Math.round(fat * scale * 10) / 10,
      fiber: Math.round(fiber * scale * 10) / 10,
    }
  }

  async function handleSubmitLog() {
    if (!logModal) return
    const overrides = logModal.recipe.ingredients
      .filter(i => logModal.checked.has(i.id))
      .map(i => ({ ingredient_id: i.id, quantity: parseFloat(logModal.quantities[i.id]) || 0 }))
      .filter(o => o.quantity > 0)
    if (overrides.length === 0) {
      setLogModal(m => ({ ...m, error: 'Select at least one ingredient with a quantity' }))
      return
    }
    const payload = {
      meal_type: logModal.mealType,
      logged_date: logModal.loggedDate,
      ingredient_overrides: overrides,
      total_cooked_weight: parseFloat(logModal.totalCookedWeight) || null,
      portion_weight: parseFloat(logModal.portionWeight) || null,
    }
    try {
      await api.logRecipe(logModal.recipe.id, payload)

      // Persist quantity/checked changes back to the template
      const updates = logModal.recipe.ingredients.flatMap(ing => {
        const nowChecked = logModal.checked.has(ing.id)
        const nowQty = parseFloat(logModal.quantities[ing.id]) || ing.quantity
        const changed = {}
        if (nowChecked !== ing.checked) changed.checked = nowChecked
        if (nowQty !== ing.quantity) changed.quantity = nowQty
        return Object.keys(changed).length > 0
          ? [api.updateIngredient(logModal.recipe.id, ing.id, changed)]
          : []
      })
      if (updates.length > 0) {
        await Promise.all(updates)
        loadRecipes()
      }

      setLogModal(null)
      loadDay(currentDate)
    } catch (err) {
      setLogModal(m => ({ ...m, error: err.message }))
    }
  }

  function recipeTotals(ingredients) {
    return {
      calories: Math.round(ingredients.reduce((s, i) => s + i.quantity * i.calories_per_unit, 0)),
      protein: Math.round(ingredients.reduce((s, i) => s + i.quantity * i.protein_per_unit, 0) * 10) / 10,
      carbs: Math.round(ingredients.reduce((s, i) => s + i.quantity * i.carbs_per_unit, 0) * 10) / 10,
      fat: Math.round(ingredients.reduce((s, i) => s + i.quantity * i.fat_per_unit, 0) * 10) / 10,
      fiber: Math.round(ingredients.reduce((s, i) => s + i.quantity * i.fiber_per_unit, 0) * 10) / 10,
    }
  }

  async function handleDelete(id) {
    try {
      await api.deleteMeal(id)
      loadDay(currentDate)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleSaveGoals(e) {
    e.preventDefault()
    setSavingGoals(true)
    try {
      const updated = await api.updateProfile({
        calorie_goal: parseInt(goalEdits.calorie_goal),
        protein_goal: parseInt(goalEdits.protein_goal),
        carbs_goal: parseInt(goalEdits.carbs_goal),
        fat_goal: parseInt(goalEdits.fat_goal),
        fiber_goal: parseInt(goalEdits.fiber_goal),
      })
      setProfile(updated)
      setShowSettings(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingGoals(false)
    }
  }

  const goal = profile?.calorie_goal || 2000
  const total = summary?.total_calories || 0
  const pct = Math.min(100, (total / goal) * 100)
  const over = total > goal

  const macroTotals = {
    protein: Math.round(summary?.total_protein || 0),
    carbs: Math.round(summary?.total_carbs || 0),
    fat: Math.round(summary?.total_fat || 0),
    fiber: Math.round(summary?.total_fiber || 0),
  }

  const macroGoals = {
    protein: profile?.protein_goal || 150,
    carbs: profile?.carbs_goal || 250,
    fat: profile?.fat_goal || 65,
    fiber: profile?.fiber_goal || 30,
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-mono">
      <header className="max-w-2xl mx-auto px-5 pt-10 pb-0 flex justify-between items-end">
        <h1 className="text-5xl font-black tracking-tight">fu<span className="text-blue-600">el</span></h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <button onClick={() => setCurrentDate(offsetDate(currentDate, -1))}
              className="w-7 h-7 rounded-full bg-white border border-slate-200 hover:border-blue-600 transition-colors flex items-center justify-center text-base">‹</button>
            <span className="text-slate-700 text-sm">{formatDate(currentDate)}</span>
            <button onClick={() => { if (currentDate < today) setCurrentDate(offsetDate(currentDate, 1)) }}
              disabled={currentDate >= today}
              className="w-7 h-7 rounded-full bg-white border border-slate-200 hover:border-blue-600 transition-colors flex items-center justify-center text-base disabled:opacity-30">›</button>
          </div>
          <button onClick={() => setShowSettings(s => !s)}
            className={`text-xs transition-colors ${showSettings ? 'text-blue-600' : 'text-slate-500 hover:text-slate-600'}`}>
            goals
          </button>
          <button onClick={signOut} className="text-xs text-slate-500 hover:text-slate-600">sign out</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6 flex flex-col gap-5">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">{error}</div>}

        {showSettings && profile && (
          <div className="bg-white border border-blue-600/30 rounded-2xl p-5">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Daily Goals</p>
            <form onSubmit={handleSaveGoals} className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'calorie_goal', label: 'Calories', unit: 'kcal' },
                  { key: 'protein_goal', label: 'Protein', unit: 'g' },
                  { key: 'carbs_goal', label: 'Carbs', unit: 'g' },
                  { key: 'fat_goal', label: 'Fat', unit: 'g' },
                  { key: 'fiber_goal', label: 'Fiber', unit: 'g' },
                ].map(({ key, label, unit }) => (
                  <div key={key} className="flex-1 min-w-24">
                    <label className="block text-xs text-slate-500 mb-1">{label} ({unit})</label>
                    <input type="number" min="1" value={goalEdits[key] || ''}
                      onChange={e => setGoalEdits(g => ({ ...g, [key]: e.target.value }))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-600" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowSettings(false)}
                  className="text-xs text-slate-500 hover:text-slate-600 px-3 py-2">Cancel</button>
                <button type="submit" disabled={savingGoals}
                  className="bg-blue-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-blue-500 transition-colors disabled:opacity-50 text-sm">
                  {savingGoals ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex justify-between items-baseline mb-4">
            <div className="flex items-baseline gap-4">
              <span className="text-5xl font-bold text-blue-600" style={{ fontFamily: 'Georgia, serif' }}>
                {loading ? '—' : total.toLocaleString()}
              </span>
              <div className="text-xs text-slate-500 leading-relaxed">
                <span className="block text-lg text-slate-900" style={{ fontFamily: 'Georgia, serif' }}>
                  {loading ? '—' : Math.abs(goal - total).toLocaleString()}
                </span>
                {over ? 'kcal over' : 'kcal left'}
              </div>
            </div>
            <span className="text-xs text-slate-500">goal: {goal.toLocaleString()} kcal</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-5">
            <div className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-gradient-to-r from-orange-400 to-red-500' : 'bg-gradient-to-r from-blue-500 to-sky-400'}`}
              style={{ width: `${pct}%` }} />
          </div>
          {!loading && (
            <div className="flex gap-4">
              <MacroBar label="Protein" value={macroTotals.protein} goal={macroGoals.protein} color="bg-sky-500" />
              <MacroBar label="Carbs" value={macroTotals.carbs} goal={macroGoals.carbs} color="bg-emerald-400" />
              <MacroBar label="Fat" value={macroTotals.fat} goal={macroGoals.fat} color="bg-orange-500" />
              <MacroBar label="Fiber" value={macroTotals.fiber} goal={macroGoals.fiber} color="bg-violet-500" />
            </div>
          )}
        </div>

        {isToday && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <button
                onClick={() => { setShowRecipePicker(s => !s); setLogModal(null) }}
                className="text-sm font-bold bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-500 transition-colors">
                + Log a dish
              </button>
              <button onClick={() => { setShowRecipeBuilder(s => !s); setActiveRecipe(null); setRecipeIngredients([]) }}
                className="text-xs text-slate-500 hover:text-blue-600 transition-colors">
                {showRecipeBuilder ? 'cancel' : 'manage templates'}
              </button>
            </div>

            {showRecipePicker && !showRecipeBuilder && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-3">
                {recipes.length === 0 ? (
                  <p className="text-xs text-slate-500 px-4 py-3">No templates yet — create one via "manage templates".</p>
                ) : (
                  recipes.map(recipe => (
                    <button key={recipe.id}
                      onClick={() => { openLogModal(recipe); setShowRecipePicker(false) }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-200 last:border-0">
                      <p className="text-sm text-slate-900">{recipe.name}</p>
                      <div className="flex gap-3 mt-0.5 text-xs text-slate-500">
                        <span className="text-blue-600/80">{Math.round(recipe.total_calories)} kcal</span>
                        <span>P {Math.round(recipe.total_protein * 10) / 10}g</span>
                        <span>C {Math.round(recipe.total_carbs * 10) / 10}g</span>
                        <span>F {Math.round(recipe.total_fat * 10) / 10}g</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {showRecipeBuilder && (
              <div className="bg-white border border-blue-600/20 rounded-2xl p-5 mb-3">
                {recipeError && <div className="text-red-600 text-xs mb-3">{recipeError}</div>}
                {!activeRecipe ? (
                  <div className="flex flex-col gap-3">
                    {recipes.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {recipes.map(recipe => (
                          <div key={recipe.id} className="flex items-center justify-between px-3 py-2 bg-slate-200 rounded-xl">
                            <span className="text-sm text-slate-700">{recipe.name}</span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleEditRecipe(recipe)}
                                className="text-xs text-slate-500 hover:text-blue-600 transition-colors">edit</button>
                              <button onClick={() => handleDeleteRecipe(recipe.id)}
                                className="text-slate-400 hover:text-red-600 transition-colors text-xs">✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <form onSubmit={handleCreateRecipe} className="flex gap-2">
                      <input type="text" placeholder="New template name" value={recipeName}
                        onChange={e => setRecipeName(e.target.value)}
                        className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-600" />
                      <button type="submit" disabled={!recipeName.trim()}
                        className="bg-blue-600 text-white font-bold px-4 py-2.5 rounded-xl hover:bg-blue-500 transition-colors disabled:opacity-50 text-sm whitespace-nowrap">
                        Create
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center gap-2">
                      <input value={builderName} onChange={e => setBuilderName(e.target.value)}
                        onBlur={handleRenameRecipe}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleRenameRecipe())}
                        className="flex-1 bg-transparent text-sm text-slate-900 font-bold focus:outline-none border-b border-transparent focus:border-blue-600 transition-colors pb-0.5" />
                      <button type="button" onClick={handleDoneBuilding}
                        className="text-xs bg-blue-600 text-white font-bold px-3 py-1.5 rounded-xl hover:bg-blue-500 transition-colors whitespace-nowrap">
                        Done
                      </button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input type="text" placeholder="Search ingredient" value={recipeQuery}
                        onChange={e => setRecipeQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleRecipeSearch())}
                        className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-600" />
                      <input type="number" value={recipeGrams} onChange={e => setRecipeGrams(e.target.value)} min="1"
                        className="w-16 bg-white border border-slate-300 rounded-xl px-2 py-2 text-sm focus:outline-none focus:border-blue-600" />
                      <span className="text-xs text-slate-500">g</span>
                      <button type="button" onClick={handleRecipeSearch} disabled={recipeSearching || !recipeQuery.trim()}
                        className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-600 hover:border-blue-600 transition-colors disabled:opacity-40 whitespace-nowrap">
                        {recipeSearching ? '...' : 'search'}
                      </button>
                    </div>
                    {recipeSearchResults.length > 0 && (
                      <div className="bg-white border border-slate-300 rounded-xl overflow-hidden">
                        {recipeSearchResults.slice(0, 6).map(food => (
                          <button key={food.fdc_id} type="button" onClick={() => handleAddRecipeIngredient(food)}
                            className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm border-b border-slate-200/50 last:border-0 transition-colors">
                            <span className="text-slate-900">{food.name}</span>
                            <span className="text-slate-500 text-xs ml-2">{food.calories_per_100g} kcal/100g</span>
                            <span className="text-blue-600/70 text-xs ml-2">
                              +{Math.round(food.calories_per_100g * (parseFloat(recipeGrams) || 100) / 100)} kcal at {recipeGrams}g
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {recipeIngredients.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {recipeIngredients.map(ing => (
                          <div key={ing.id} className={`px-3 py-2 bg-slate-200 rounded-xl text-sm transition-opacity ${!ing.checked ? 'opacity-50' : ''}`}>
                            <div className="flex items-center gap-2">
                              <input type="checkbox" checked={!!ing.checked}
                                onChange={async () => {
                                  const updated = await api.updateIngredient(activeRecipe.id, ing.id, { checked: !ing.checked })
                                  setRecipeIngredients(prev => prev.map(i => i.id === ing.id ? updated : i))
                                }}
                                className="accent-blue-600 w-3.5 h-3.5 flex-shrink-0" />
                              <span className="flex-1 text-slate-700">{ing.food_name}</span>
                              <input type="number"
                                defaultValue={ing.quantity}
                                onBlur={async e => {
                                  const val = parseFloat(e.target.value)
                                  if (val > 0 && val !== ing.quantity) {
                                    const updated = await api.updateIngredient(activeRecipe.id, ing.id, { quantity: val })
                                    setRecipeIngredients(prev => prev.map(i => i.id === ing.id ? updated : i))
                                  }
                                }}
                                onKeyDown={async e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    const val = parseFloat(e.target.value)
                                    if (val > 0 && val !== ing.quantity) {
                                      const updated = await api.updateIngredient(activeRecipe.id, ing.id, { quantity: val })
                                      setRecipeIngredients(prev => prev.map(i => i.id === ing.id ? updated : i))
                                    }
                                  }
                                }}
                                min="1" step="1"
                                className="w-16 bg-slate-300 border border-slate-300 rounded-xl px-2 py-1 text-sm text-center focus:outline-none focus:border-blue-600" />
                              <span className="text-xs text-slate-500">g</span>
                              <button type="button" onClick={() => handleRemoveIngredient(ing.id)}
                                className="text-slate-400 hover:text-red-600 transition-colors text-xs">✕</button>
                            </div>
                            <div className="flex gap-3 mt-1 ml-5 text-xs text-slate-500">
                              <span className="text-blue-600">{Math.round(ing.quantity * ing.calories_per_unit)} kcal</span>
                              <span>P <span className="text-slate-600">{(ing.quantity * ing.protein_per_unit).toFixed(1)}g</span></span>
                              <span>C <span className="text-slate-600">{(ing.quantity * ing.carbs_per_unit).toFixed(1)}g</span></span>
                              <span>F <span className="text-slate-600">{(ing.quantity * ing.fat_per_unit).toFixed(1)}g</span></span>
                              <span>Fb <span className="text-slate-600">{(ing.quantity * ing.fiber_per_unit).toFixed(1)}g</span></span>
                            </div>
                          </div>
                        ))}
                        {(() => {
                          const t = recipeTotals(recipeIngredients)
                          return (
                            <div className="flex gap-3 px-3 py-2 text-xs text-slate-500 border-t border-slate-200 mt-1">
                              <span className="text-blue-600 font-bold">{t.calories} kcal</span>
                              <span>P {t.protein}g</span>
                              <span>C {t.carbs}g</span>
                              <span>F {t.fat}g</span>
                              <span>Fb {t.fiber}g</span>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {logModal && (
              <div className="bg-white border border-blue-600/30 rounded-2xl p-5 mt-3">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-slate-900">{logModal.recipe.name}</p>
                  <button onClick={() => setLogModal(null)} className="text-xs text-slate-500 hover:text-slate-600">cancel</button>
                </div>
                {logModal.error && <div className="text-red-600 text-xs mb-3">{logModal.error}</div>}

                <div className="flex flex-col gap-1 mb-4">
                  {logModal.recipe.ingredients.map(ing => {
                    const isChecked = logModal.checked.has(ing.id)
                    const qty = parseFloat(logModal.quantities[ing.id]) || 0
                    return (
                      <div key={ing.id} className={`px-3 py-2 bg-slate-200 rounded-xl text-sm transition-opacity ${!isChecked ? 'opacity-40' : ''}`}>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={isChecked}
                            onChange={() => setLogModal(m => {
                              const checked = new Set(m.checked)
                              if (checked.has(ing.id)) checked.delete(ing.id)
                              else checked.add(ing.id)
                              return { ...m, checked }
                            })}
                            className="accent-blue-600 w-3.5 h-3.5 flex-shrink-0" />
                          <span className="flex-1 text-slate-700">{ing.food_name}</span>
                          <input type="number" value={logModal.quantities[ing.id]}
                            onChange={e => setLogModal(m => ({ ...m, quantities: { ...m.quantities, [ing.id]: e.target.value } }))}
                            disabled={!isChecked}
                            min="0" step="1"
                            className="w-16 bg-slate-300 border border-slate-300 rounded-xl px-2 py-1 text-sm text-center focus:outline-none focus:border-blue-600 disabled:opacity-30" />
                          <span className="text-xs text-slate-500">g</span>
                        </div>
                        {isChecked && (
                          <div className="flex gap-3 mt-1 ml-5 text-xs text-slate-500">
                            <span className="text-blue-600">{Math.round(qty * ing.calories_per_unit)} kcal</span>
                            <span>P <span className="text-slate-600">{(qty * ing.protein_per_unit).toFixed(1)}g</span></span>
                            <span>C <span className="text-slate-600">{(qty * ing.carbs_per_unit).toFixed(1)}g</span></span>
                            <span>F <span className="text-slate-600">{(qty * ing.fat_per_unit).toFixed(1)}g</span></span>
                            <span>Fb <span className="text-slate-600">{(qty * ing.fiber_per_unit).toFixed(1)}g</span></span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {(() => {
                  const m = logModalMacros()
                  return (
                    <div className="flex gap-3 px-3 py-2 text-xs border-t border-slate-200 mb-4">
                      <span className="text-slate-500">Total:</span>
                      <span className="text-blue-600 font-bold">{m.calories} kcal</span>
                      <span className="text-slate-600">P {m.protein}g</span>
                      <span className="text-slate-600">C {m.carbs}g</span>
                      <span className="text-slate-600">F {m.fat}g</span>
                      <span className="text-slate-600">Fb {m.fiber}g</span>
                    </div>
                  )
                })()}

                {(() => {
                  const rawWeight = logModal.recipe.ingredients
                    .filter(i => logModal.checked.has(i.id))
                    .reduce((s, i) => s + (parseFloat(logModal.quantities[i.id]) || 0), 0)
                  return (
                    <div className="flex gap-2 text-xs text-slate-500 mb-3">
                      <span>Total raw weight:</span>
                      <span className="text-slate-600 font-medium">{Math.round(rawWeight)}g</span>
                    </div>
                  )
                })()}
                <div className="flex flex-wrap gap-2 mb-4">
                  <div className="flex-1 min-w-32">
                    <label className="block text-xs text-slate-500 mb-1">Total cooked weight (g)</label>
                    <input type="number" value={logModal.totalCookedWeight} min="1"
                      onChange={e => setLogModal(m => ({ ...m, totalCookedWeight: e.target.value }))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-600" />
                  </div>
                  <div className="flex-1 min-w-32">
                    <label className="block text-xs text-slate-500 mb-1">Amount consumed (g)</label>
                    <input type="number" value={logModal.portionWeight} min="1"
                      onChange={e => setLogModal(m => ({ ...m, portionWeight: e.target.value }))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-600" />
                  </div>
                </div>

                <div className="flex gap-2">
                  <select value={logModal.mealType} onChange={e => setLogModal(m => ({ ...m, mealType: e.target.value }))}
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-600">
                    {MEAL_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <input type="date" value={logModal.loggedDate}
                    onChange={e => setLogModal(m => ({ ...m, loggedDate: e.target.value }))}
                    max={today}
                    className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-600" />
                  <button onClick={handleSubmitLog}
                    className="bg-blue-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-blue-500 transition-colors text-sm whitespace-nowrap">
                    Log dish
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">
            {isToday ? "Today's meals" : `Meals on ${formatDate(currentDate)}`}
          </p>
          {loading ? (
            <div className="text-slate-400 text-sm py-8 text-center">Loading...</div>
          ) : summary?.meals.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              <span className="block text-2xl mb-2">🍽</span>
              No dishes logged{isToday ? ' yet today' : ' for this day'}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {MEAL_TYPES.filter(type => summary?.meals.some(m => m.meal_type === type)).map(type => {
                const typeMeals = summary.meals.filter(m => m.meal_type === type)
                const sub = {
                  cal: typeMeals.reduce((s, m) => s + m.calories, 0),
                  protein: Math.round(typeMeals.reduce((s, m) => s + m.protein_g, 0) * 10) / 10,
                  carbs: Math.round(typeMeals.reduce((s, m) => s + m.carbs_g, 0) * 10) / 10,
                  fat: Math.round(typeMeals.reduce((s, m) => s + m.fat_g, 0) * 10) / 10,
                  fiber: Math.round(typeMeals.reduce((s, m) => s + m.fiber_g, 0) * 10) / 10,
                }
                return (
                  <div key={type}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <p className="text-xs text-slate-500 uppercase tracking-widest">{type}</p>
                      <div className="flex gap-2.5 text-xs text-slate-500">
                        <span>{sub.cal} kcal</span>
                        <span>P {sub.protein}g</span>
                        <span>C {sub.carbs}g</span>
                        <span>F {sub.fat}g</span>
                        <span>Fb {sub.fiber}g</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {typeMeals.map(meal => (
                        <div key={meal.id} className="bg-white border border-slate-200 rounded-xl px-3 py-2">
                          <div className="flex justify-between items-center gap-2">
                            <p className="text-sm text-slate-900 truncate">{meal.name}</p>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {meal.recipe_id && (
                                <button onClick={() => openTemplate(meal.recipe_id)} className="text-xs text-blue-600/60 hover:text-blue-600 transition-colors">template</button>
                              )}
                              <button onClick={() => handleDelete(meal.id)} className="text-slate-400 hover:text-red-600 transition-colors text-xs">✕</button>
                            </div>
                          </div>
                          <div className="flex gap-2.5 mt-1 text-xs text-slate-500">
                            <span>{meal.calories} kcal</span>
                            <span>P {meal.protein_g}g</span>
                            <span>C {meal.carbs_g}g</span>
                            <span>F {meal.fat_g}g</span>
                            <span>Fb {meal.fiber_g}g</span>
                          </div>
                          {meal.raw_weight != null && (
                            <div className="flex gap-2.5 mt-1 text-xs text-slate-400 items-center">
                              <span>raw {meal.raw_weight}g</span>
                              {meal.total_cooked_weight != null && <span>· cooked {meal.total_cooked_weight}g</span>}
                              {meal.total_cooked_weight != null && (
                                editingPortion?.mealId === meal.id ? (
                                  <span className="flex items-center gap-1">
                                    ·&nbsp;ate&nbsp;
                                    <input
                                      type="number" min="1" step="1"
                                      value={editingPortion.value}
                                      onChange={e => setEditingPortion(p => ({ ...p, value: e.target.value }))}
                                      onBlur={async () => {
                                        const val = parseFloat(editingPortion.value)
                                        if (val > 0) {
                                          const updated = await api.patchMealPortion(meal.id, val)
                                          setSummary(s => ({ ...s, meals: s.meals.map(m => m.id === meal.id ? updated : m) }))
                                        }
                                        setEditingPortion(null)
                                      }}
                                      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingPortion(null) }}
                                      autoFocus
                                      className="w-14 bg-white border border-blue-600 rounded px-1 py-0 text-xs text-slate-700 focus:outline-none"
                                    />
                                    g
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => setEditingPortion({ mealId: meal.id, value: String(meal.portion_weight ?? meal.total_cooked_weight) })}
                                    className="hover:text-blue-600 transition-colors">
                                    · ate {meal.portion_weight ?? meal.total_cooked_weight}g
                                  </button>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">Past days</p>
            <div className="flex flex-col gap-2">
              {history.map(h => (
                <button key={h.date} onClick={() => setCurrentDate(h.date)}
                  className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex justify-between items-center hover:border-blue-600/50 transition-colors text-left">
                  <span className="text-sm text-slate-600">{formatDate(h.date)}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, (h.calories / goal) * 100)}%` }} />
                    </div>
                    <span className="text-sm font-bold text-blue-600" style={{ fontFamily: 'Georgia, serif' }}>{h.calories.toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
