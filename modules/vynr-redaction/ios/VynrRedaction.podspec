Pod::Spec.new do |s|
  s.name           = 'VynrRedaction'
  s.version        = '1.0.0'
  s.summary        = 'On-device face and text-region pixelation for VYNR'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = 'VYNR'
  s.homepage       = 'https://github.com/aaravjit/vynr'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/aaravjit/vynr.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision', 'CoreImage'
  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'SWIFT_COMPILATION_MODE' => 'wholemodule' }
end
