const CallSkeleton = () => {
  // Create an array of 8 items for skeleton call history items
  const skeletonCalls = Array(8).fill(null);

  return (
    <div className="flex-1 overflow-auto custom-scrollbar select-none">
      {/* <div className="font-semibold text-base ml-4 mt-4">Recent</div> */}
      {skeletonCalls.map((_, idx) => (
        <div key={idx} className="flex items-center gap-3 px-4 py-3 rounded-lg">
          {/* Avatar skeleton */}
          <div className="w-10 h-10 rounded-full">
            <div className="skeleton w-full h-full rounded-full" />
          </div>
          
          {/* Content skeleton */}
          <div className="flex-1">
            {/* Name skeleton */}
            <div className="skeleton h-4 w-24 mb-1" />
            {/* Call type skeleton */}
            <div className="skeleton h-3 w-16" />
          </div>
          
          {/* Time skeleton */}
          <div className="skeleton h-3 w-12" />
        </div>
      ))}
    </div>
  );
};

export default CallSkeleton; 