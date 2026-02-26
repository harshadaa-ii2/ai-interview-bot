import React from 'react'
import { TrendingUp, Target, Zap, Award, BarChart3, PieChart } from 'lucide-react'

function AnalyticsDashboard({ dashboard, difficultyScores }) {
  if (!dashboard) return null

  // Helper function to determine color based on score
  const getScoreColor = (score) => {
    if (score >= 85) return 'from-green-500 to-green-600'
    if (score >= 75) return 'from-blue-500 to-blue-600'
    if (score >= 65) return 'from-yellow-500 to-yellow-600'
    return 'from-red-500 to-red-600'
  }

  const getScoreTextColor = (score) => {
    if (score >= 85) return 'text-green-700'
    if (score >= 75) return 'text-blue-700'
    if (score >= 65) return 'text-yellow-700'
    return 'text-red-700'
  }

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'excellent': return 'bg-green-100 text-green-800'
      case 'good': return 'bg-blue-100 text-blue-800'
      case 'fair': return 'bg-yellow-100 text-yellow-800'
      case 'poor': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Calculate average trend for performance line
  const maxScore = Math.max(...dashboard.performanceTrend.map(t => t.score))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-2">Interview Analytics Dashboard</h1>
          <p className="text-slate-400">Comprehensive Performance Analysis & Insights</p>
        </div>

        {/* Overall Score Banner */}
        <div className={`bg-gradient-to-r ${getScoreColor(dashboard.overallScore)} rounded-xl p-8 text-white shadow-2xl transform transition hover:scale-105`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-200 text-lg mb-2">Overall Interview Score</p>
              <h2 className="text-6xl font-bold">{Math.round(dashboard.overallScore)}%</h2>
            </div>
            <div className="text-7xl opacity-20">
              <Target />
            </div>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {dashboard.kpis.map((kpi, idx) => (
            <div key={idx} className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition shadow-lg">
              <div className="flex justify-between items-start mb-4">
                <p className="text-slate-300 text-sm font-medium">{kpi.label}</p>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusBadgeColor(kpi.status)}`}>
                  {kpi.status}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">
                  {typeof kpi.value === 'number' && kpi.unit !== 'sec' ? Math.round(kpi.value) : Math.round(kpi.value)}
                </span>
                <span className={`${typeof kpi.value === 'number' && kpi.unit !== 'sec' ? 'text-blue-400' : 'text-slate-400'} text-sm`}>
                  {kpi.unit}
                </span>
              </div>
              {kpi.unit === 'sec' && (
                <p className="text-xs text-slate-400 mt-2">Average response time</p>
              )}
            </div>
          ))}
        </div>

        {/* Performance Over Time Chart */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="text-blue-400" size={24} />
            <h3 className="text-xl font-bold text-white">Performance Over Time</h3>
          </div>
          
          <div className="space-y-4">
            {dashboard.performanceTrend.map((trend, idx) => (
              <div key={idx}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white font-medium">Q{trend.question}</span>
                  <span className={`text-sm font-semibold ${getScoreTextColor(trend.score)}`}>
                    {Math.round(trend.score)}%
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div
                    className={`bg-gradient-to-r ${getScoreColor(trend.score)} h-full rounded-full transition-all duration-500`}
                    style={{ width: `${trend.score}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">{trend.feedback}</p>
              </div>
            ))}
          </div>

          {/* Trend insight */}
          <div className="mt-6 p-4 bg-slate-700 rounded-lg border-l-4 border-blue-500">
            <p className="text-slate-200 text-sm">
              📊 <span className="font-semibold">Trend Analysis:</span> Performance {
                dashboard.performanceTrend[dashboard.performanceTrend.length - 1].score > dashboard.performanceTrend[0].score
                  ? 'improved'
                  : 'declined'
              } from Q1 to Q5
            </p>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Skill Breakdown */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 shadow-lg">
            <div className="flex items-center gap-2 mb-6">
              <PieChart className="text-purple-400" size={24} />
              <h3 className="text-xl font-bold text-white">Skill Breakdown</h3>
            </div>

            <div className="space-y-4">
              {dashboard.skillBreakdown.map((skill, idx) => (
                <div key={idx}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-300 font-medium">{skill.skill}</span>
                    <span className="text-white font-bold">{Math.round(skill.percentage)}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${skill.percentage}%`,
                        backgroundColor: skill.color
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Pie Chart SVG Visualization */}
            <div className="mt-6 flex justify-center">
              <svg width="200" height="200" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="100" fill="none" stroke="#334155" strokeWidth="1" opacity="0.3" />
                {dashboard.skillBreakdown.map((skill, idx) => {
                  const total = dashboard.skillBreakdown.reduce((sum, s) => sum + s.percentage, 0)
                  let startAngle = 0
                  for (let i = 0; i < idx; i++) {
                    startAngle += (dashboard.skillBreakdown[i].percentage / total) * 360
                  }
                  const percentage = skill.percentage / total
                  const angle = percentage * 360
                  const startRad = (startAngle - 90) * Math.PI / 180
                  const endRad = (startAngle + angle - 90) * Math.PI / 180
                  
                  const x1 = 100 + 80 * Math.cos(startRad)
                  const y1 = 100 + 80 * Math.sin(startRad)
                  const x2 = 100 + 80 * Math.cos(endRad)
                  const y2 = 100 + 80 * Math.sin(endRad)
                  
                  const largeArcFlag = angle > 180 ? 1 : 0
                  
                  return (
                    <path
                      key={idx}
                      d={`M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                      fill={skill.color}
                      opacity="0.8"
                    />
                  )
                })}
              </svg>
            </div>
          </div>

          {/* Category Performance */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 shadow-lg">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="text-orange-400" size={24} />
              <h3 className="text-xl font-bold text-white">Performance by Category</h3>
            </div>

            <div className="space-y-4">
              {dashboard.categoryPerformance.map((cat, idx) => (
                <div key={idx}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-300 font-medium text-sm">{cat.category}</span>
                    <span className="text-white font-bold">{Math.round(cat.score)}/{cat.maxScore}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`bg-gradient-to-r ${getScoreColor(cat.score)} h-full rounded-full transition-all duration-500`}
                      style={{ width: `${(cat.score / cat.maxScore) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Difficulty Level Performance - Heatmap */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="text-yellow-400" size={24} />
            <h3 className="text-xl font-bold text-white">Difficulty-Level Performance</h3>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {Object.entries(difficultyScores || {}).map(([level, score]) => (
              <div key={level} className={`bg-gradient-to-br ${getScoreColor(score)} rounded-lg p-6 text-white text-center shadow-lg transform transition hover:scale-105`}>
                <p className="text-lg font-semibold mb-2">{level}</p>
                <p className="text-4xl font-bold">{Math.round(score)}%</p>
                <p className="text-sm text-white text-opacity-80 mt-2">
                  {score >= 85 ? 'Excellent' : score >= 75 ? 'Good' : score >= 65 ? 'Fair' : 'Needs Work'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Strengths and Improvements */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Strengths */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 shadow-lg border-l-4 border-l-green-500">
            <div className="flex items-center gap-2 mb-6">
              <Award className="text-green-400" size={24} />
              <h3 className="text-xl font-bold text-white">Strengths</h3>
            </div>

            <ul className="space-y-3">
              {dashboard.strengths.map((strength, idx) => (
                <li key={idx} className="flex gap-3 text-slate-300">
                  <span className="text-green-400 font-bold flex-shrink-0">✓</span>
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Areas for Improvement */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 shadow-lg border-l-4 border-l-orange-500">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="text-orange-400" size={24} />
              <h3 className="text-xl font-bold text-white">Areas for Improvement</h3>
            </div>

            <ul className="space-y-3">
              {dashboard.improvements.map((improvement, idx) => (
                <li key={idx} className="flex gap-3 text-slate-300">
                  <span className="text-orange-400 font-bold flex-shrink-0">→</span>
                  <span>{improvement}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Final Recommendation */}
        <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 rounded-lg p-8 border border-indigo-700 shadow-lg">
          <h3 className="text-2xl font-bold text-white mb-4">Final Recommendation</h3>
          <p className="text-indigo-100 text-lg leading-relaxed mb-6">
            {dashboard.recommendation}
          </p>

          <div className="flex gap-4">
            <button
              onClick={() => window.print()}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition transform hover:scale-105 shadow-lg"
            >
              Print Report
            </button>
            <button
              onClick={() => {
                const element = document.createElement('a')
                const dashboardText = `
INTERVIEW ANALYTICS DASHBOARD
=============================

OVERALL SCORE: ${Math.round(dashboard.overallScore)}%

KPI METRICS:
${dashboard.kpis.map(kpi => `- ${kpi.label}: ${Math.round(kpi.value)}${kpi.unit}`).join('\n')}

PERFORMANCE TREND (Q1-Q5):
${dashboard.performanceTrend.map(t => `Q${t.question}: ${Math.round(t.score)}% - ${t.feedback}`).join('\n')}

SKILL BREAKDOWN:
${dashboard.skillBreakdown.map(s => `- ${s.skill}: ${Math.round(s.percentage)}%`).join('\n')}

CATEGORY PERFORMANCE:
${dashboard.categoryPerformance.map(c => `- ${c.category}: ${Math.round(c.score)}/${c.maxScore}`).join('\n')}

DIFFICULTY PERFORMANCE:
${Object.entries(difficultyScores || {}).map(([level, score]) => `- ${level}: ${Math.round(score)}%`).join('\n')}

STRENGTHS:
${dashboard.strengths.map(s => `✓ ${s}`).join('\n')}

AREAS FOR IMPROVEMENT:
${dashboard.improvements.map(i => `→ ${i}`).join('\n')}

FINAL RECOMMENDATION:
${dashboard.recommendation}
                `.trim()
                element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(dashboardText))
                element.setAttribute('download', 'interview_analytics_dashboard.txt')
                element.style.display = 'none'
                document.body.appendChild(element)
                element.click()
                document.body.removeChild(element)
              }}
              className="px-6 py-3 bg-white hover:bg-gray-100 text-indigo-700 rounded-lg font-semibold transition transform hover:scale-105 shadow-lg"
            >
              Download Report
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-slate-400 text-sm mt-12">
          <p>Interview Analytics Dashboard • Generated by AI Interview Assistant</p>
        </div>
      </div>
    </div>
  )
}

export default AnalyticsDashboard
