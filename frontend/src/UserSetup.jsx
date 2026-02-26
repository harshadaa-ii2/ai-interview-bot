import React, { useState } from 'react';

const INTERVIEW_TYPES = {
  Engineering: [
    'Software', 'Mechanical', 'Electrical', 'Civil', 'Chemical', 'Other'
  ],
  'E-commerce': [],
  Finance: [],
  'Other': []
};

export default function UserSetup({ onSubmit }) {
  const [name, setName] = useState('');
  const [resume, setResume] = useState(null);
  const [interviewType, setInterviewType] = useState('Engineering');
  const [subType, setSubType] = useState('Software');
  const [error, setError] = useState('');
  const [experience, setExperience] = useState('');
  const [education, setEducation] = useState('');

  const handleResumeChange = (e) => {
    setResume(e.target.files[0]);
  };

  const handleTypeChange = (e) => {
    setInterviewType(e.target.value);
    setSubType(INTERVIEW_TYPES[e.target.value][0] || '');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !resume) {
      setError('Please fill all fields and upload your resume.');
      return;
    }
    setError('');
    // Pass data to parent or send to backend
    onSubmit && onSubmit({ name, resume, interviewType, subType, experience, education });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-violet-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Candidate Information</h2>
          <p className="text-gray-600">Please provide your details to get started</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
            <input type="text" className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-600 transition" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Experience (Years)</label>
            <input type="text" className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-600 transition" value={experience} onChange={e => setExperience(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Education</label>
            <input type="text" className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-600 transition" value={education} onChange={e => setEducation(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Upload Resume</label>
            <div className="border-2 border-dashed border-purple-300 rounded-lg p-4 hover:border-purple-600 transition cursor-pointer relative">
              <input type="file" accept=".pdf,.doc,.docx" className="w-full absolute inset-0 opacity-0 cursor-pointer" onChange={handleResumeChange} required />
              <div className="text-center pointer-events-none">
                <p className="text-gray-600 mb-1">Drop resume here or click to select</p>
                {resume && <p className="text-sm text-green-600 font-semibold">✓ {resume.name}</p>}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Interview Type</label>
            <select className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-600 transition" value={interviewType} onChange={handleTypeChange} required>
              {Object.keys(INTERVIEW_TYPES).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          {INTERVIEW_TYPES[interviewType].length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Field</label>
              <select className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-600 transition" value={subType} onChange={e => setSubType(e.target.value)}>
                {INTERVIEW_TYPES[interviewType].map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          )}
          {error && <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 text-sm rounded">{error}</div>}
          <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-violet-700 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition transform hover:scale-105">
            Start Interview
          </button>
        </form>
      </div>
    </div>
  );
}
