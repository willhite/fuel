import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack']

function formatDate(dateStr) {
  const today = new Date().toISOString().split('T')[0]
  if (dateStr === today) return 'Today'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function offsetDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export default function Dashboard() {
  const { signOut } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0])
  const [summary, setSummary] = useState(null)
  const [profile, setProfile] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mealName, setMealName] = useState('')
  const [mealCal, setMealCal] = useState('')
  const [mealType, setMealType] = useState('Breakfast')
  const [adding, setAdding] = useState(false)

  const today = new Date().toISOString().split('T')[0]
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

  async function handleAddMeal(e) {
    e.preventDefault()
    if (!mealName.trim() || !mealCal) return
    setAdding(true)
    try {
      await api.addMeal({ name: mealName.trim(), calories: parseInt(mealCal), meal_type: mealType, logged_date: currentDate })
      setMealName('')
      setMealCal('')
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

  const goal = profile?.calorie_goal || 2000
  const total = summary?.total_calories || 0
  const pct = Math.min(100, (total / goal) * 100)
  const over = total > goal

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
          <button onClick={signOut} className="text-xs text-neutral-600 hover:text-neutral-400 ml-2">sign out</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6 flex flex-col gap-5">
        {error && <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm">{error}</div>}

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
          <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-gradient-to-r from-orange-400 to-red-500' : 'bg-gradient-to-r from-amber-400 to-orange-400'}`}
              style={{ width: `${pct}%` }} />
          </div>
        </div>

        {isToday && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
            <p className="text-xs text-neutral-500 uppercase tracking-widest mb-4">Log a meal</p>
            <form onSubmit={handleAddMeal} className="flex flex-wrap gap-2">
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
              {summary?.meals.map(meal => (
                <div key={meal.id} className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 flex justify-between items-center">
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
              ))}
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
