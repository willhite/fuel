import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack']

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
        <span className="text-xs text-neutral-500">{label}</span>
        <span className={`text-xs font-bold ${over ? 'text-red-400' : 'text-neutral-300'}`}>{value}g</span>
      </div>
      <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-500' : color}`}
          style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-neutral-700 mt-0.5">{goal}g</div>
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
  const [mealName, setMealName] = useState('')
  const [mealCal, setMealCal] = useState('')
  const [mealType, setMealType] = useState('Breakfast')
  const [mealProtein, setMealProtein] = useState('')
  const [mealCarbs, setMealCarbs] = useState('')
  const [mealFat, setMealFat] = useState('')
  const [mealFiber, setMealFiber] = useState('')
  const [adding, setAdding] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [goalEdits, setGoalEdits] = useState({})
  const [savingGoals, setSavingGoals] = useState(false)

  const today = localToday()
  const isToday = currentDate === today

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

  async function handleAddMeal(e) {
    e.preventDefault()
    if (!mealName.trim() || !mealCal) return
    setAdding(true)
    try {
      await api.addMeal({
        name: mealName.trim(),
        calories: parseInt(mealCal),
        meal_type: mealType,
        logged_date: currentDate,
        protein_g: mealProtein ? parseFloat(mealProtein) : 0,
        carbs_g: mealCarbs ? parseFloat(mealCarbs) : 0,
        fat_g: mealFat ? parseFloat(mealFat) : 0,
        fiber_g: mealFiber ? parseFloat(mealFiber) : 0,
      })
      setMealName('')
      setMealCal('')
      setMealProtein('')
      setMealCarbs('')
      setMealFat('')
      setMealFiber('')
      loadDay(currentDate)
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
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
    <div className="min-h-screen bg-neutral-950 text-white font-mono">
      <header className="max-w-2xl mx-auto px-5 pt-10 pb-0 flex justify-between items-end">
        <h1 className="text-5xl font-black tracking-tight">fu<span className="text-amber-400">el</span></h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <button onClick={() => setCurrentDate(offsetDate(currentDate, -1))}
              className="w-7 h-7 rounded-full bg-neutral-900 border border-neutral-800 hover:border-amber-400 transition-colors flex items-center justify-center text-base">‹</button>
            <span className="text-neutral-300 text-sm">{formatDate(currentDate)}</span>
            <button onClick={() => { if (currentDate < today) setCurrentDate(offsetDate(currentDate, 1)) }}
              disabled={currentDate >= today}
              className="w-7 h-7 rounded-full bg-neutral-900 border border-neutral-800 hover:border-amber-400 transition-colors flex items-center justify-center text-base disabled:opacity-30">›</button>
          </div>
          <button onClick={() => setShowSettings(s => !s)}
            className={`text-xs transition-colors ${showSettings ? 'text-amber-400' : 'text-neutral-600 hover:text-neutral-400'}`}>
            goals
          </button>
          <button onClick={signOut} className="text-xs text-neutral-600 hover:text-neutral-400">sign out</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6 flex flex-col gap-5">
        {error && <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm">{error}</div>}

        {showSettings && profile && (
          <div className="bg-neutral-900 border border-amber-400/30 rounded-2xl p-5">
            <p className="text-xs text-neutral-500 uppercase tracking-widest mb-4">Daily Goals</p>
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
                    <label className="block text-xs text-neutral-500 mb-1">{label} ({unit})</label>
                    <input type="number" min="1" value={goalEdits[key] || ''}
                      onChange={e => setGoalEdits(g => ({ ...g, [key]: e.target.value }))}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowSettings(false)}
                  className="text-xs text-neutral-600 hover:text-neutral-400 px-3 py-2">Cancel</button>
                <button type="submit" disabled={savingGoals}
                  className="bg-amber-400 text-neutral-950 font-bold px-4 py-2 rounded-xl hover:bg-amber-300 transition-colors disabled:opacity-50 text-sm">
                  {savingGoals ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
          <div className="flex justify-between items-baseline mb-4">
            <div className="flex items-baseline gap-4">
              <span className="text-5xl font-bold text-amber-400" style={{ fontFamily: 'Georgia, serif' }}>
                {loading ? '—' : total.toLocaleString()}
              </span>
              <div className="text-xs text-neutral-500 leading-relaxed">
                <span className="block text-lg text-white" style={{ fontFamily: 'Georgia, serif' }}>
                  {loading ? '—' : Math.abs(goal - total).toLocaleString()}
                </span>
                {over ? 'kcal over' : 'kcal left'}
              </div>
            </div>
            <span className="text-xs text-neutral-600">goal: {goal.toLocaleString()} kcal</span>
          </div>
          <div className="h-2 bg-neutral-800 rounded-full overflow-hidden mb-5">
            <div className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-gradient-to-r from-orange-400 to-red-500' : 'bg-gradient-to-r from-amber-400 to-orange-400'}`}
              style={{ width: `${pct}%` }} />
          </div>
          {!loading && (
            <div className="flex gap-4">
              <MacroBar label="Protein" value={macroTotals.protein} goal={macroGoals.protein} color="bg-blue-500" />
              <MacroBar label="Carbs" value={macroTotals.carbs} goal={macroGoals.carbs} color="bg-green-500" />
              <MacroBar label="Fat" value={macroTotals.fat} goal={macroGoals.fat} color="bg-yellow-500" />
              <MacroBar label="Fiber" value={macroTotals.fiber} goal={macroGoals.fiber} color="bg-purple-500" />
            </div>
          )}
        </div>

        {isToday && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
            <p className="text-xs text-neutral-500 uppercase tracking-widest mb-4">Log a meal</p>
            <form onSubmit={handleAddMeal} className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <input type="text" placeholder="Meal name" value={mealName} onChange={e => setMealName(e.target.value)}
                  className="flex-[2] min-w-36 bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-sm placeholder-neutral-600 focus:outline-none focus:border-amber-400" />
                <input type="number" placeholder="kcal" value={mealCal} onChange={e => setMealCal(e.target.value)} min="1"
                  className="flex-1 min-w-20 bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-sm placeholder-neutral-600 focus:outline-none focus:border-amber-400" />
                <select value={mealType} onChange={e => setMealType(e.target.value)}
                  className="flex-1 min-w-24 bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400">
                  {MEAL_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <button type="submit" disabled={adding}
                  className="bg-amber-400 text-neutral-950 font-bold px-5 py-2.5 rounded-xl hover:bg-amber-300 transition-colors disabled:opacity-50 text-sm whitespace-nowrap">
                  {adding ? '...' : '+ Add'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {[
                  { val: mealProtein, set: setMealProtein, placeholder: 'protein g' },
                  { val: mealCarbs, set: setMealCarbs, placeholder: 'carbs g' },
                  { val: mealFat, set: setMealFat, placeholder: 'fat g' },
                  { val: mealFiber, set: setMealFiber, placeholder: 'fiber g' },
                ].map(({ val, set, placeholder }) => (
                  <input key={placeholder} type="number" placeholder={placeholder} value={val}
                    onChange={e => set(e.target.value)} min="0" step="0.1"
                    className="flex-1 min-w-20 bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-sm placeholder-neutral-600 focus:outline-none focus:border-amber-400/50" />
                ))}
                <span className="text-xs text-neutral-700 px-1">optional</span>
              </div>
            </form>
          </div>
        )}

        <div>
          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-3">
            {isToday ? "Today's meals" : `Meals on ${formatDate(currentDate)}`}
          </p>
          {loading ? (
            <div className="text-neutral-700 text-sm py-8 text-center">Loading...</div>
          ) : summary?.meals.length === 0 ? (
            <div className="text-center py-10 text-neutral-700 text-sm">
              <span className="block text-2xl mb-2">🍽</span>
              No meals logged{isToday ? ' yet today' : ' for this day'}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {summary?.meals.map(meal => {
                const hasMacros = meal.protein_g > 0 || meal.carbs_g > 0 || meal.fat_g > 0 || meal.fiber_g > 0
                return (
                  <div key={meal.id} className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-white">{meal.name}</p>
                        <span className="text-xs text-amber-400/70 bg-neutral-800 rounded-full px-2 py-0.5 mt-1 inline-block">{meal.meal_type}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-amber-400" style={{ fontFamily: 'Georgia, serif' }}>{meal.calories}</span>
                        {isToday && (
                          <button onClick={() => handleDelete(meal.id)} className="text-neutral-700 hover:text-red-400 transition-colors text-sm">✕</button>
                        )}
                      </div>
                    </div>
                    {hasMacros && (
                      <div className="flex gap-3 mt-2 text-xs text-neutral-600">
                        {meal.protein_g > 0 && <span>P <span className="text-neutral-400">{meal.protein_g}g</span></span>}
                        {meal.carbs_g > 0 && <span>C <span className="text-neutral-400">{meal.carbs_g}g</span></span>}
                        {meal.fat_g > 0 && <span>F <span className="text-neutral-400">{meal.fat_g}g</span></span>}
                        {meal.fiber_g > 0 && <span>Fb <span className="text-neutral-400">{meal.fiber_g}g</span></span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-widest mb-3">Past days</p>
            <div className="flex flex-col gap-2">
              {history.map(h => (
                <button key={h.date} onClick={() => setCurrentDate(h.date)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 flex justify-between items-center hover:border-amber-400/50 transition-colors text-left">
                  <span className="text-sm text-neutral-400">{formatDate(h.date)}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(100, (h.calories / goal) * 100)}%` }} />
                    </div>
                    <span className="text-sm font-bold text-amber-400" style={{ fontFamily: 'Georgia, serif' }}>{h.calories.toLocaleString()}</span>
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
