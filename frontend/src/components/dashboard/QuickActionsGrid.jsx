import React from 'react';

/**
 * Quick actions grid for dashboard navigation
 * @param {Array} actions - Array of action objects with {id, label, icon, color, shadow}
 * @param {Function} onNavigate - Navigation callback
 * @param {Function} hasAccess - Permission check function (optional)
 */
export const QuickActionsGrid = ({ actions = [], onNavigate, hasAccess }) => {
  const filteredActions = hasAccess 
    ? actions.filter(action => hasAccess(action.id))
    : actions;

  return (
    <div>
      <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Quick Actions</h3>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 sm:gap-3">
        {filteredActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => onNavigate && onNavigate(action.id)}
              className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br ${action.color} text-white transition-all transform hover:scale-105 active:scale-95 shadow-md ${action.shadow || ''} dark:shadow-none`}
              data-testid={`quick-${action.id}`}
            >
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5 sm:mb-1" />
              <span className="text-[9px] sm:text-[10px] font-medium text-center leading-tight">{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuickActionsGrid;
