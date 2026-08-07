#!/usr/bin/env ruby
# frozen_string_literal: true

#
# Structural checks on the iOS project, for a machine without Xcode.
#
# `xcodebuild`, `actool` and `ibtool` all require the full Xcode install, so a
# real compile is not available in CI or on a setup machine. These are the
# checks that can still be made, and they cover the failures that actually
# happen when a native project is edited by tooling rather than by hand: a file
# reference left pointing at nothing, a Swift file never added to Compile
# Sources, a storyboard naming a class that does not exist, an asset catalog
# listing an image that was never written, a Podfile and lock that disagree.
#
# It is not a substitute for building. It is the difference between finding
# those in five seconds and finding them after a 15 GB Xcode install.
#
# Run: npm run verify:ios
#
require 'xcodeproj'
require 'json'
require 'rexml/document'

pass = 0; fail = 0
def ok(n,c,d='') ; puts "  #{c ? 'PASS' : 'FAIL'}  #{n}#{d.empty? ? '' : "  — #{d}"}" ; c ; end
def check(n,c,d=''); $results << ok(n,c,d); end
$results = []

proj = Xcodeproj::Project.open('ios/App/App.xcodeproj')
target = proj.targets.find { |t| t.name == 'App' }
check('the Xcode project opens and has an App target', !target.nil?)

# Every file reference must point at something that exists on disk.
missing = []
proj.files.each do |f|
  next unless f.source_tree == '<group>'
  path = f.real_path.to_s
  missing << f.display_name unless File.exist?(path)
end
check('no dangling file references', missing.empty?, missing.empty? ? '' : missing.join(', '))

# Swift sources are actually compiled.
srcs = target.source_build_phase.files.map { |f| f.file_ref&.display_name }.compact
check('MainViewController.swift is in Compile Sources', srcs.include?('MainViewController.swift'), srcs.join(' + '))

# Bundle id and deployment target on every configuration.
ids = target.build_configurations.map { |c| c.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] }.uniq
check('bundle identifier is com.weddingmall.app everywhere', ids == ['com.weddingmall.app'], ids.join(','))
dts = target.build_configurations.map { |c| c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] }.uniq
check('deployment target is 15.0 everywhere', dts == ['15.0'], dts.join(','))

# The storyboard must name a class the project actually compiles.
sb = REXML::Document.new(File.read('ios/App/App/Base.lproj/Main.storyboard'))
classes = []
sb.each_element('//*[@customClass]') { |e| classes << e.attributes['customClass'] }
check('Main.storyboard parses as XML', true)
check('storyboard points at MainViewController', classes.include?('MainViewController'), classes.join(','))
swift_class = File.read('ios/App/App/MainViewController.swift')[/class\s+(\w+)/, 1]
check('that class exists in the Swift source', swift_class == 'MainViewController', "declared: #{swift_class}")

# Asset catalogs: every filename listed must be on disk.
%w[AppIcon.appiconset Splash.imageset].each do |set|
  dir = "ios/App/App/Assets.xcassets/#{set}"
  json = JSON.parse(File.read("#{dir}/Contents.json"))
  files = json['images'].map { |i| i['filename'] }.compact
  absent = files.reject { |f| File.exist?("#{dir}/#{f}") }
  check("#{set}: all #{files.size} referenced images exist", absent.empty?, absent.join(','))
end

# The App Store rejects an icon containing an alpha channel, at upload, after
# the archive has been built and pushed. Reading the PNG header costs nothing
# and moves that discovery to now. IHDR: width/height at bytes 16..23, colour
# type at byte 25 (4 and 6 carry alpha).
icon = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'
header = File.binread(icon, 26)
width, height = header[16, 4].unpack1('N'), header[20, 4].unpack1('N')
colour_type = header[25].ord
check('app icon is 1024x1024', width == 1024 && height == 1024, "#{width}x#{height}")
check('app icon has no alpha channel (App Store rejects it)', ![4, 6].include?(colour_type),
      "PNG colour type #{colour_type}")

# Podfile and lock agree.
pf  = File.read('ios/App/Podfile')
lock = File.read('ios/App/Podfile.lock')
check('Podfile platform is 15.0', pf.include?("platform :ios, '15.0'"))
pods = pf.scan(/pod '([^']+)'/).flatten
absent = pods.reject { |p| lock.include?(p) }
check("Podfile.lock covers all #{pods.size} pods", absent.empty?, absent.join(','))

f = $results.count(false)
puts "\n  #{$results.count(true)} passed, #{f} failed"
exit(f.zero? ? 0 : 1)
