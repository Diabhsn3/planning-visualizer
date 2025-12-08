# macOS Build Fix for Fast Downward

## Problem

Fast Downward fails to build on macOS with errors like:
```
error: no type named 'size_t' in namespace 'std'
error: no type named 'nothrow_t' in namespace 'std'
```

**Root Cause:** AppleClang has incomplete C++20 support. Fast Downward requires C++20.

**Solution:** Use GCC instead of AppleClang.

## Quick Fix (Recommended)

Run this simple script that handles everything:

```bash
cd ~/Desktop/planning-visualizer
git pull origin front_back
./fix_macos_gcc.sh
```

This script will:
1. ✅ Check if you have Homebrew
2. ✅ Install GCC if needed (~5-10 min first time)
3. ✅ Clean old builds
4. ✅ Build Fast Downward with GCC
5. ✅ Verify success

## What the Script Does

```bash
# Finds or installs GCC
brew install gcc  # if needed

# Sets compiler to GCC
export CC=/usr/local/bin/gcc-14
export CXX=/usr/local/bin/g++-14

# Cleans CMake cache
rm -rf planning-tools/downward/builds

# Builds with GCC
cd planning-tools/downward
./build.py release
```

## Expected Output

### Success:
```
====================================
  macOS Fast Downward GCC Fix
====================================

✅ Running on macOS

Step 1: Checking Homebrew...
✅ Homebrew found: /usr/local/bin/brew

Step 2: Checking for GCC...
✅ Found GCC 14
   GCC: /usr/local/bin/gcc-14
   G++: /usr/local/bin/g++-14

Step 3: Checking directory...
✅ Directory OK

Step 4: Cleaning old builds...
✅ Cleaned builds directory

Step 5: Building Fast Downward with GCC...
This will take 5-10 minutes...

Compiler configuration:
  CC=/usr/local/bin/gcc-14
  CXX=/usr/local/bin/g++-14

Building configuration release.
-- The C compiler identification is GNU 14.2.0
-- The CXX compiler identification is GNU 14.2.0
...
[100%] Built target downward

====================================
✅ SUCCESS! Fast Downward built with GCC
====================================
```

## After Success

Once the build succeeds, you can run the main application:

```bash
./run_new.sh
```

The app will detect that Fast Downward is already built and skip the build step.

## Troubleshooting

### If GCC installation fails:
```bash
brew update
brew install gcc
```

### If you don't have Homebrew:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### If the script says "directory not found":
Make sure you're in the repository root:
```bash
cd ~/Desktop/planning-visualizer
pwd  # Should show: /Users/yourname/Desktop/planning-visualizer
./fix_macos_gcc.sh
```

### If build still fails with AppleClang errors:
The script might not have exported CC/CXX properly. Try manually:
```bash
export CC=$(which gcc-14)
export CXX=$(which g++-14)
cd planning-tools/downward
rm -rf builds
./build.py release
```

## Why This Works

| Compiler | C++20 Support | Fast Downward |
|----------|--------------|---------------|
| AppleClang 14-16 | ⚠️ Incomplete | ❌ Fails |
| **GCC 11-14** | ✅ Complete | ✅ **Works** |

GCC has full C++20 standard library support, while AppleClang's implementation is incomplete.

## Technical Details

The issue is that AppleClang's C++ standard library (`libc++`) doesn't fully implement C++20 features that Fast Downward uses. GCC's standard library (`libstdc++`) has complete C++20 support.

The fix:
1. Installs GCC via Homebrew
2. Exports `CC` and `CXX` to point to GCC
3. Cleans CMake cache (CMake caches compiler choice)
4. Builds with GCC instead of AppleClang

## Files

- `fix_macos_gcc.sh` - Simple standalone fix script (use this!)
- `build_fd_macos.sh` - Alternative build script
- `run_new.sh` - Main application launcher (has GCC support built-in, but may not work if already cached)
