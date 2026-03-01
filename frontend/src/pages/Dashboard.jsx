import { useState, useEffect, useCallback, Fragment } from 'react'
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

function MacroBar({ label, value, min, max, color }) {
  const hasRange = min != null && max != null && max > 0
  const pct = hasRange ? Math.min(100, (value / max) * 100) : 0
  const barColor = hasRange
    ? (value < min ? 'bg-amber-400' : value > max ? 'bg-red-500' : 'bg-green-500')
    : color
  const labelColor = hasRange
    ? (value < min ? 'text-amber-500' : value > max ? 'text-red-600' : 'text-green-600')
    : 'text-slate-400'
  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-slate-500">{label}</span>
        <span className={`text-xs font-bold ${labelColor}`}>{value}g</span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-slate-400 mt-0.5">
        {hasRange ? `${min}–${max}g` : '—'}
      </div>
    </div>
  )
}

const DAY_TYPE_FIELDS = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
]

function DayTypeFormFields({ form, setForm, onSubmit, saving, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 py-2">
      <input
        type="text" placeholder="Type name (e.g. Lift, Rest)"
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-600"
      />
      <div className="grid gap-1.5">
        <div className="grid grid-cols-6 gap-1.5 text-xs text-slate-400 px-0.5">
          <span className="col-span-2"></span>
          <span className="text-center">Min</span>
          <span className="text-center">Max</span>
        </div>
        {DAY_TYPE_FIELDS.map(({ key, label, unit }) => (
          <div key={key} className="grid grid-cols-6 gap-1.5 items-center">
            <span className="col-span-2 text-xs text-slate-500">{label} ({unit})</span>
            <input type="number" min="0" placeholder="0"
              value={form[`${key}_min`]}
              onChange={e => setForm(f => ({ ...f, [`${key}_min`]: e.target.value }))}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-blue-600" />
            <input type="number" min="0" placeholder="0"
              value={form[`${key}_max`]}
              onChange={e => setForm(f => ({ ...f, [`${key}_max`]: e.target.value }))}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-blue-600" />
          </div>
        ))}
      </div>
      <div className="flex gap-2 justify-end mt-1">
        <button type="button" onClick={onCancel}
          className="text-xs text-slate-500 hover:text-slate-600 px-3 py-1.5">Cancel</button>
        <button type="submit" disabled={saving || !form.name.trim()}
          className="bg-blue-600 text-white font-bold px-4 py-1.5 rounded-xl hover:bg-blue-500 transition-colors disabled:opacity-50 text-xs">
          {saving ? 'Saving...' : (form.id ? 'Update' : 'Add')}
        </button>
      </div>
    </form>
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
  const [recipes, setRecipes] = useState([])
  const [showRecipeBuilder, setShowRecipeBuilder] = useState(false)
  const [showRecipePicker, setShowRecipePicker] = useState(false)
  const [activeRecipe, setActiveRecipe] = useState(null)
  const [recipeName, setRecipeName] = useState('')
  const [recipeIngredients, setRecipeIngredients] = useState([])
  const [recipeQuery, setRecipeQuery] = useState('')
  const [recipeGrams, setRecipeGrams] = useState('100')
  const [ingredients, setIngredients] = useState([])
  const [recipeError, setRecipeError] = useState('')
  const [builderName, setBuilderName] = useState('')
  const [logModal, setLogModal] = useState(null)
  const [editingPortion, setEditingPortion] = useState(null)
  const [viewMode, setViewMode] = useState('cards')
  const [dayTypes, setDayTypes] = useState([])
  const [dayTypeForm, setDayTypeForm] = useState(null) // null | 'new' | {id, ...editing}
  const [dayTypeSaving, setDayTypeSaving] = useState(false)

  const today = localToday()
  const isToday = currentDate === today

  const loadRecipes = useCallback(async () => {
    try {
      const data = await api.getRecipes()
      setRecipes(data)
    } catch (_) {}
  }, [])

  const loadIngredients = useCallback(async () => {
    try {
      const data = await api.getIngredients()
      setIngredients(data)
    } catch (_) {}
  }, [])

  useEffect(() => { loadRecipes() }, [loadRecipes])
  useEffect(() => { loadIngredients() }, [loadIngredients])

  const loadDay = useCallback(async (date) => {
    setLoading(true)
    setError('')
    try {
      const [dayData, profileData, histData, typesData] = await Promise.all([
        api.getDay(date),
        api.getProfile(),
        api.getHistory(7),
        api.getDayTypes(),
      ])
      setSummary(dayData)
      setProfile(profileData)
      setHistory(histData.filter(h => h.date !== date))
      setDayTypes(typesData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDay(currentDate) }, [currentDate, loadDay])

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

  async function handleAddRecipeIngredient(food) {
    if (!activeRecipe) return
    setRecipeQuery('')
    const g = parseFloat(recipeGrams) || 100
    const ingredient = {
      food_name: food.name,
      quantity: g,
      unit: 'g',
      usda_fdc_id: food.usda_fdc_id || null,
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

  async function openTemplate(recipeId, meal) {
    const recipe = recipes.find(r => r.id === recipeId)
    if (!recipe) return
    setShowRecipePicker(false)
    setShowRecipeBuilder(false)
    if (meal) {
      try {
        const restored = await api.restoreTemplate(recipeId, meal.id)
        setRecipes(rs => rs.map(r => r.id === recipeId ? restored : r))
        openLogModal(restored)
        // Override with the specific meal's cooked/portion/type values
        setLogModal(prev => ({
          ...prev,
          totalCookedWeight: meal.total_cooked_weight != null ? String(meal.total_cooked_weight) : prev.totalCookedWeight,
          portionWeight: meal.portion_weight != null ? String(meal.portion_weight) : (meal.total_cooked_weight != null ? String(meal.total_cooked_weight) : prev.portionWeight),
          mealType: meal.meal_type ?? prev.mealType,
        }))
      } catch {
        openLogModal(recipe)
      }
    } else {
      openLogModal(recipe)
    }
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
      }
      loadRecipes()

      setLogModal(null)
      loadDay(currentDate)
    } catch (err) {
      setLogModal(m => ({ ...m, error: err.message }))
    }
  }

  function recipeTotals(ingredients) {
    const checked = ingredients.filter(i => i.checked)
    return {
      calories: Math.round(checked.reduce((s, i) => s + i.quantity * i.calories_per_unit, 0)),
      protein: Math.round(checked.reduce((s, i) => s + i.quantity * i.protein_per_unit, 0) * 10) / 10,
      carbs: Math.round(checked.reduce((s, i) => s + i.quantity * i.carbs_per_unit, 0) * 10) / 10,
      fat: Math.round(checked.reduce((s, i) => s + i.quantity * i.fat_per_unit, 0) * 10) / 10,
      fiber: Math.round(checked.reduce((s, i) => s + i.quantity * i.fiber_per_unit, 0) * 10) / 10,
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

  const EMPTY_DAY_TYPE = { id: null, name: '', calories_min: '', calories_max: '', protein_min: '', protein_max: '', carbs_min: '', carbs_max: '', fat_min: '', fat_max: '', fiber_min: '', fiber_max: '' }

  async function handleSaveDayType(e) {
    e.preventDefault()
    if (!dayTypeForm?.name?.trim()) return
    setDayTypeSaving(true)
    try {
      const payload = {
        name: dayTypeForm.name.trim(),
        calories_min: parseInt(dayTypeForm.calories_min) || 0,
        calories_max: parseInt(dayTypeForm.calories_max) || 0,
        protein_min: parseInt(dayTypeForm.protein_min) || 0,
        protein_max: parseInt(dayTypeForm.protein_max) || 0,
        carbs_min: parseInt(dayTypeForm.carbs_min) || 0,
        carbs_max: parseInt(dayTypeForm.carbs_max) || 0,
        fat_min: parseInt(dayTypeForm.fat_min) || 0,
        fat_max: parseInt(dayTypeForm.fat_max) || 0,
        fiber_min: parseInt(dayTypeForm.fiber_min) || 0,
        fiber_max: parseInt(dayTypeForm.fiber_max) || 0,
      }
      if (dayTypeForm.id) {
        const updated = await api.updateDayType(dayTypeForm.id, payload)
        setDayTypes(prev => prev.map(dt => dt.id === updated.id ? updated : dt).sort((a, b) => a.name.localeCompare(b.name)))
      } else {
        const created = await api.createDayType(payload)
        setDayTypes(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      }
      setDayTypeForm(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setDayTypeSaving(false)
    }
  }

  async function handleDeleteDayType(id) {
    try {
      await api.deleteDayType(id)
      setDayTypes(prev => prev.filter(dt => dt.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleSetDefaultDayType(id) {
    const newId = profile?.default_day_type_id === id ? null : id
    try {
      await api.updateProfile({ default_day_type_id: newId })
      setProfile(p => ({ ...p, default_day_type_id: newId }))
    } catch (err) {
      setError(err.message)
    }
  }

  const dayType = summary?.day_type || null
  const calMin = dayType?.calories_min ?? null
  const calMax = dayType?.calories_max ?? null
  const total = summary?.total_calories || 0
  const pct = calMax ? Math.min(100, (total / calMax) * 100) : 0
  const calStatus = calMax != null
    ? (total < calMin ? 'under' : total > calMax ? 'over' : 'on target')
    : null
  const calTextColor = calStatus === 'under' ? 'text-amber-500'
    : calStatus === 'on target' ? 'text-green-600'
    : calStatus === 'over' ? 'text-red-600'
    : 'text-blue-600'
  const calBarColor = calStatus === 'under' ? 'bg-gradient-to-r from-amber-400 to-yellow-400'
    : calStatus === 'on target' ? 'bg-gradient-to-r from-green-500 to-emerald-400'
    : calStatus === 'over' ? 'bg-gradient-to-r from-orange-400 to-red-500'
    : 'bg-gradient-to-r from-blue-500 to-sky-400'

  const macroTotals = {
    protein: Math.round(summary?.total_protein || 0),
    carbs: Math.round(summary?.total_carbs || 0),
    fat: Math.round(summary?.total_fat || 0),
    fiber: Math.round(summary?.total_fiber || 0),
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-mono">
      <header className="max-w-2xl mx-auto px-5 pt-10 pb-0 flex justify-between items-end">
        <h1 className="text-5xl font-black tracking-tight">fu<span className="text-blue-600">el</span></h1>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <button onClick={() => setCurrentDate(offsetDate(currentDate, -1))}
                className="w-7 h-7 rounded-full bg-white border border-slate-200 hover:border-blue-600 transition-colors flex items-center justify-center text-base">‹</button>
              <span className="text-slate-700 text-sm">{formatDate(currentDate)}</span>
              <button onClick={() => { if (currentDate < today) setCurrentDate(offsetDate(currentDate, 1)) }}
                disabled={currentDate >= today}
                className="w-7 h-7 rounded-full bg-white border border-slate-200 hover:border-blue-600 transition-colors flex items-center justify-center text-base disabled:opacity-30">›</button>
            </div>
            <select
              value={summary?.day_type?.id || ''}
              onChange={async e => {
                if (e.target.value) await api.setDayLog(currentDate, e.target.value)
                else await api.clearDayLog(currentDate)
                loadDay(currentDate)
              }}
              className="text-xs text-slate-500 bg-transparent border-none focus:outline-none cursor-pointer"
            >
              <option value="">— day type —</option>
              {dayTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
            </select>
          </div>
          <button onClick={() => setShowSettings(s => !s)}
            className={`text-xs transition-colors ${showSettings ? 'text-blue-600' : 'text-slate-500 hover:text-slate-600'}`}>
            day types
          </button>
          <button onClick={signOut} className="text-xs text-slate-500 hover:text-slate-600">sign out</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6 flex flex-col gap-5">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">{error}</div>}

        {showSettings && profile && (
          <div className="bg-white border border-blue-600/30 rounded-2xl p-5">
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs text-slate-500 uppercase tracking-widest">Day Types</p>
              {!dayTypeForm && (
                <button onClick={() => setDayTypeForm(EMPTY_DAY_TYPE)}
                  className="text-xs text-blue-600 hover:text-blue-500 transition-colors">+ add type</button>
              )}
            </div>

            {dayTypes.map(dt => (
              <div key={dt.id}>
                {dayTypeForm?.id === dt.id ? (
                  <DayTypeFormFields form={dayTypeForm} setForm={setDayTypeForm} onSubmit={handleSaveDayType} saving={dayTypeSaving} onCancel={() => setDayTypeForm(null)} />
                ) : (
                  <div className="flex items-center justify-between py-1.5 text-xs">
                    <span className="text-slate-800 font-medium">{dt.name}</span>
                    <div className="flex items-center gap-3 text-slate-400">
                      <span>{dt.calories_min}–{dt.calories_max} kcal</span>
                      <span>P {dt.protein_min}–{dt.protein_max}</span>
                      <span>C {dt.carbs_min}–{dt.carbs_max}</span>
                      <span>F {dt.fat_min}–{dt.fat_max}</span>
                      <button onClick={() => handleSetDefaultDayType(dt.id)} title="Set as default"
                        className={profile?.default_day_type_id === dt.id ? 'text-amber-400' : 'hover:text-amber-300 transition-colors'}>★</button>
                      <button onClick={() => setDayTypeForm({ id: dt.id, name: dt.name, calories_min: dt.calories_min, calories_max: dt.calories_max, protein_min: dt.protein_min, protein_max: dt.protein_max, carbs_min: dt.carbs_min, carbs_max: dt.carbs_max, fat_min: dt.fat_min, fat_max: dt.fat_max, fiber_min: dt.fiber_min, fiber_max: dt.fiber_max })}
                        className="hover:text-blue-600 transition-colors">edit</button>
                      <button onClick={() => handleDeleteDayType(dt.id)}
                        className="hover:text-red-500 transition-colors">✕</button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {dayTypeForm && !dayTypeForm.id && (
              <DayTypeFormFields form={dayTypeForm} setForm={setDayTypeForm} onSubmit={handleSaveDayType} saving={dayTypeSaving} onCancel={() => setDayTypeForm(null)} />
            )}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex justify-between items-baseline mb-4">
            <div className="flex items-baseline gap-4">
              <span className={`text-5xl font-bold ${calTextColor}`} style={{ fontFamily: 'Georgia, serif' }}>
                {loading ? '—' : total.toLocaleString()}
              </span>
              <div className="text-xs text-slate-500 leading-relaxed">
                <span className="block text-lg text-slate-900" style={{ fontFamily: 'Georgia, serif' }}>
                  {loading ? '—' : calMax != null
                    ? (calStatus === 'under' ? (calMin - total).toLocaleString() : calStatus === 'over' ? (total - calMax).toLocaleString() : '✓')
                    : '—'}
                </span>
                {calStatus === 'on target' ? 'on target' : calStatus === 'under' ? 'kcal to min' : calStatus === 'over' ? 'kcal over' : ''}
              </div>
            </div>
            <span className="text-xs text-slate-500">
              {calMax != null ? `${calMin.toLocaleString()}–${calMax.toLocaleString()} kcal` : ''}
            </span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-5">
            <div className={`h-full rounded-full transition-all duration-500 ${calBarColor}`}
              style={{ width: `${pct}%` }} />
          </div>
          {!loading && (
            <div className="flex gap-4">
              <MacroBar label="Protein" value={macroTotals.protein} min={dayType?.protein_min} max={dayType?.protein_max} color="bg-sky-500" />
              <MacroBar label="Carbs" value={macroTotals.carbs} min={dayType?.carbs_min} max={dayType?.carbs_max} color="bg-emerald-400" />
              <MacroBar label="Fat" value={macroTotals.fat} min={dayType?.fat_min} max={dayType?.fat_max} color="bg-orange-500" />
              <MacroBar label="Fiber" value={macroTotals.fiber} min={dayType?.fiber_min} max={dayType?.fiber_max} color="bg-violet-500" />
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
                  [...recipes].sort((a, b) => a.name.localeCompare(b.name)).map(recipe => (
                    <div key={recipe.id} className="flex items-center border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors">
                      <button
                        onClick={() => { openLogModal(recipe); setShowRecipePicker(false) }}
                        className="flex-1 text-left px-4 py-3">
                        <p className="text-sm text-slate-900">{recipe.name}</p>
                        <div className="flex gap-3 mt-0.5 text-xs text-slate-500">
                          <span className="text-blue-600/80">{Math.round(recipe.total_calories)} kcal</span>
                          <span>P {Math.round(recipe.total_protein * 10) / 10}g</span>
                          <span>C {Math.round(recipe.total_carbs * 10) / 10}g</span>
                          <span>F {Math.round(recipe.total_fat * 10) / 10}g</span>
                        </div>
                      </button>
                      <button
                        onClick={() => { setShowRecipePicker(false); handleEditRecipe(recipe) }}
                        className="px-3 py-3 text-xs text-slate-400 hover:text-blue-600 transition-colors flex-shrink-0">
                        edit
                      </button>
                    </div>
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
                        {[...recipes].sort((a, b) => a.name.localeCompare(b.name)).map(recipe => (
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
                        className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-600" />
                      <input type="number" value={recipeGrams} onChange={e => setRecipeGrams(e.target.value)} min="1"
                        className="w-16 bg-white border border-slate-300 rounded-xl px-2 py-2 text-sm focus:outline-none focus:border-blue-600" />
                      <span className="text-xs text-slate-500">g</span>
                    </div>
                    {recipeQuery.trim() && (() => {
                      const matches = ingredients
                        .filter(i => i.name.toLowerCase().includes(recipeQuery.toLowerCase()))
                        .slice(0, 6)
                      return matches.length > 0 ? (
                        <div className="bg-white border border-slate-300 rounded-xl overflow-hidden">
                          {matches.map(food => (
                            <button key={food.id} type="button" onClick={() => handleAddRecipeIngredient(food)}
                              className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm border-b border-slate-200/50 last:border-0 transition-colors">
                              <span className="text-slate-900">{food.name}</span>
                              <span className="text-slate-500 text-xs ml-2">{food.calories_per_100g} kcal/100g</span>
                              <span className="text-blue-600/70 text-xs ml-2">
                                +{Math.round(food.calories_per_100g * (parseFloat(recipeGrams) || 100) / 100)} kcal at {recipeGrams}g
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 px-1">No matches in library</p>
                      )
                    })()}
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
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { const r = logModal.recipe; setLogModal(null); handleEditRecipe(r) }}
                      className="text-xs text-blue-600/60 hover:text-blue-600 transition-colors">
                      edit template
                    </button>
                    <button onClick={() => setLogModal(null)} className="text-xs text-slate-500 hover:text-slate-600">cancel</button>
                  </div>
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
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-slate-500 uppercase tracking-widest">
              {isToday ? "Today's meals" : `Meals on ${formatDate(currentDate)}`}
            </p>
            {summary?.meals.length > 0 && (
              <div className="flex gap-1">
                <button onClick={() => setViewMode('cards')}
                  className={`text-xs px-2 py-0.5 rounded transition-colors ${viewMode === 'cards' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}>
                  cards
                </button>
                <button onClick={() => setViewMode('table')}
                  className={`text-xs px-2 py-0.5 rounded transition-colors ${viewMode === 'table' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}>
                  table
                </button>
              </div>
            )}
          </div>
          {loading ? (
            <div className="text-slate-400 text-sm py-8 text-center">Loading...</div>
          ) : summary?.meals.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              <span className="block text-2xl mb-2">🍽</span>
              No dishes logged{isToday ? ' yet today' : ' for this day'}
            </div>
          ) : viewMode === 'table' ? (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                    <th className="px-4 py-2 text-left font-medium w-24">Meal</th>
                    <th className="px-4 py-2 text-left font-medium">Item</th>
                    <th className="px-4 py-2 text-right font-medium tabular-nums">kcal</th>
                    <th className="px-4 py-2 text-right font-medium tabular-nums">Protein</th>
                    <th className="px-4 py-2 text-right font-medium tabular-nums">Carbs</th>
                    <th className="px-4 py-2 text-right font-medium tabular-nums">Fat</th>
                    <th className="px-4 py-2 text-right font-medium tabular-nums">Fiber</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {MEAL_TYPES.filter(type => summary.meals.some(m => m.meal_type === type)).map(type => {
                    const typeMeals = summary.meals.filter(m => m.meal_type === type)
                    const sub = {
                      cal: typeMeals.reduce((s, m) => s + m.calories, 0),
                      protein: Math.round(typeMeals.reduce((s, m) => s + (m.protein_g || 0), 0)),
                      carbs: Math.round(typeMeals.reduce((s, m) => s + (m.carbs_g || 0), 0)),
                      fat: Math.round(typeMeals.reduce((s, m) => s + (m.fat_g || 0), 0)),
                      fiber: Math.round(typeMeals.reduce((s, m) => s + (m.fiber_g || 0), 0)),
                    }
                    return (
                      <Fragment key={type}>
                        {typeMeals.map((meal, i) => (
                          <tr key={meal.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors text-xs">
                            <td className="px-4 py-1.5 text-slate-400 whitespace-nowrap">
                              {i === 0 ? type : ''}
                            </td>
                            <td className="px-4 py-1.5">
                              {meal.recipe_id
                                ? <button onClick={() => openTemplate(meal.recipe_id, meal)} className="text-blue-600 hover:underline text-left">{meal.name}</button>
                                : <span className="text-slate-900">{meal.name}</span>}
                            </td>
                            <td className="px-4 py-1.5 text-right tabular-nums text-slate-700">{meal.calories}</td>
                            <td className="px-4 py-1.5 text-right tabular-nums text-slate-600">{Math.round(meal.protein_g)}g</td>
                            <td className="px-4 py-1.5 text-right tabular-nums text-slate-600">{Math.round(meal.carbs_g)}g</td>
                            <td className="px-4 py-1.5 text-right tabular-nums text-slate-600">{Math.round(meal.fat_g)}g</td>
                            <td className="px-4 py-1.5 text-right tabular-nums text-slate-600">{Math.round(meal.fiber_g)}g</td>
                            <td className="px-4 py-1.5 text-right">
                              <button onClick={() => handleDelete(meal.id)}
                                className="text-slate-300 hover:text-red-500 transition-colors text-xs">✕</button>
                            </td>
                          </tr>
                        ))}
                        {typeMeals.length > 1 && (
                          <tr key={`${type}-sub`} className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-700">
                            <td className="px-4 py-1"></td>
                            <td className="px-4 py-1">{type} Subtotal</td>
                            <td className="px-4 py-1 text-right tabular-nums">{sub.cal}</td>
                            <td className="px-4 py-1 text-right tabular-nums">{sub.protein}g</td>
                            <td className="px-4 py-1 text-right tabular-nums">{sub.carbs}g</td>
                            <td className="px-4 py-1 text-right tabular-nums">{sub.fat}g</td>
                            <td className="px-4 py-1 text-right tabular-nums">{sub.fiber}g</td>
                            <td></td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                  <tr className="border-t-2 border-slate-200 text-xs font-bold text-slate-800 bg-slate-50">
                    <td className="px-4 py-2 uppercase tracking-wide text-slate-500">Total</td>
                    <td></td>
                    <td className="px-4 py-2 text-right tabular-nums">{summary.total_calories}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{Math.round(summary.total_protein)}g</td>
                    <td className="px-4 py-2 text-right tabular-nums">{Math.round(summary.total_carbs)}g</td>
                    <td className="px-4 py-2 text-right tabular-nums">{Math.round(summary.total_fat)}g</td>
                    <td className="px-4 py-2 text-right tabular-nums">{Math.round(summary.total_fiber)}g</td>
                    <td></td>
                  </tr>
                  {dayType && (
                    <tr className="text-xs text-slate-400 border-t border-slate-100">
                      <td className="px-4 py-2 uppercase tracking-wide">Range</td>
                      <td></td>
                      <td className="px-4 py-2 text-right tabular-nums">{dayType.calories_min}–{dayType.calories_max}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{dayType.protein_min}–{dayType.protein_max}g</td>
                      <td className="px-4 py-2 text-right tabular-nums">{dayType.carbs_min}–{dayType.carbs_max}g</td>
                      <td className="px-4 py-2 text-right tabular-nums">{dayType.fat_min}–{dayType.fat_max}g</td>
                      <td className="px-4 py-2 text-right tabular-nums">{dayType.fiber_min}–{dayType.fiber_max}g</td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
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
                                <button onClick={() => openTemplate(meal.recipe_id, meal)} className="text-xs text-blue-600/60 hover:text-blue-600 transition-colors">template</button>
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
