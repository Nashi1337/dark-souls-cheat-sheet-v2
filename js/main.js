(function($) {

    var defaultProfiles = {
        'current': 'Default Profile'
    };
    defaultProfiles[profilesKey] = {
        'Default Profile': {
            checklistData: {}
        }
    }
    var profiles = $.jStorage.get(profilesKey, defaultProfiles);

    jQuery(document).ready(function($) {

        // TODO Find a better way to do this in one pass
        $('ul li li').each(function(index) {
            if ($(this).attr('data-id')) {
                addCheckbox(this);
            }
        });
        $('ul li').each(function(index) {
            if ($(this).attr('data-id')) {
                addCheckbox(this);
            }
        });

        addSectionControls();

        populateProfiles();

        $('input[type="checkbox"]').click(function() {
            var id = $(this).attr('id');
            var isChecked = profiles[profilesKey][profiles.current].checklistData[id] = $(this).prop('checked');
            $(this).parent().parent().find('li > label > input[type="checkbox"]').each(function() {
                var id = $(this).attr('id');
                profiles[profilesKey][profiles.current].checklistData[id] = isChecked;
                $(this).prop('checked', isChecked);
            });
            $.jStorage.set(profilesKey, profiles);
            calculateTotals();
        });

        $('#profiles').change(function(event) {
            profiles.current = $(this).val();
            $.jStorage.set(profilesKey, profiles);
            populateChecklists();
        });

        $('#profileAdd').click(function() {
            $('#profileModalTitle').html('Add Profile');
            $('#profileModalName').val('');
            $('#profileModalAdd').show();
            $('#profileModalUpdate').hide();
            $('#profileModalDelete').hide();
            $('#profileModal').modal('show');
        });

        $('#profileEdit').click(function() {
            $('#profileModalTitle').html('Edit Profile');
            $('#profileModalName').val(profiles.current);
            $('#profileModalAdd').hide();
            $('#profileModalUpdate').show();
            if (canDelete()) {
                $('#profileModalDelete').show();
            } else {
                $('#profileModalDelete').hide();
            }
            $('#profileModal').modal('show');
        });

        $('#profileExport').click(function() {
            exportCurrentProgress();
        });

        $('#profileImport').click(function() {
            $('#profileImportFile').val('');
            $('#profileImportFile').trigger('click');
        });

        $('#profileImportFile').change(function(event) {
            var file = event.target.files && event.target.files[0];
            if (file) {
                importCurrentProgress(file);
            }
        });

        $('#profileModalAdd').click(function(event) {
            event.preventDefault();
            var profile = $.trim($('#profileModalName').val());
            if (profile.length > 0) {
                if (typeof profiles[profilesKey][profile] == 'undefined') {
                    profiles[profilesKey][profile] = { checklistData: {} };
                }
                profiles.current = profile;
                $.jStorage.set(profilesKey, profiles);
                populateProfiles();
                populateChecklists();
            }
            $('#profileModal').modal('hide');
        });

        $('#profileModalUpdate').click(function(event) {
            event.preventDefault();
            var newName = $.trim($('#profileModalName').val());
            if (newName.length > 0 && newName != profiles.current) {
                profiles[profilesKey][newName] = profiles[profilesKey][profiles.current];
                delete profiles[profilesKey][profiles.current];
                profiles.current = newName;
                $.jStorage.set(profilesKey, profiles);
                populateProfiles();
            }
            $('#profileModal').modal('hide');
        });

        $('#profileModalDelete').click(function(event) {
            event.preventDefault();
            if (!canDelete()) {
                return;
            }
            if (!confirm('Are you sure?')) {
                return;
            }
            delete profiles[profilesKey][profiles.current];
            profiles.current = getFirstProfile();
            $.jStorage.set(profilesKey, profiles);
            populateProfiles();
            populateChecklists();
            $('#profileModal').modal('hide');
        });

        $('#profileModalClose').click(function(event) {
            event.preventDefault();
            $('#profileModal').modal('hide');
        });

        calculateTotals();

    });

    function populateProfiles() {
        $('#profiles').empty();
        $.each(profiles[profilesKey], function(index, value) {
            $('#profiles').append($("<option></option>").attr('value', index).text(index));
        });
        $('#profiles').val(profiles.current);
    }

    function populateChecklists() {
        $('input[type="checkbox"]').prop('checked', false);
        $.each(profiles[profilesKey][profiles.current].checklistData, function(index, value) {
            $('#' + index).prop('checked', value);
        });
        calculateTotals();
    }

    function calculateTotals() {
        $('[id$="_overall_total"]').each(function(index) {
            var type = this.id.match(/(.*)_overall_total/)[1];
            var overallCount = 0, overallChecked = 0;
            $('[id^="' + type + '_totals_"]').each(function(index) {
                var regex = new RegExp(type + '_totals_(.*)');
                var i = parseInt(this.id.match(regex)[1]);
                var count = 0, checked = 0;
                for (var j = 1; ; j++) {
                    var checkbox = $('#' + type + '_' + i + '_' + j);
                    if (checkbox.length == 0) {
                        break;
                    }
                    count++;
                    overallCount++;
                    if (checkbox.prop('checked')) {
                        checked++;
                        overallChecked++;
                    }
                }
                if (checked == count) {
                    this.innerHTML = $('#' + type + '_nav_totals_' + i)[0].innerHTML = '[DONE]';
                    $(this).removeClass('in_progress').addClass('done');
                    $($('#' + type + '_nav_totals_' + i)[0]).removeClass('in_progress').addClass('done');
                } else {
                    this.innerHTML = $('#' + type + '_nav_totals_' + i)[0].innerHTML = '[' + checked + '/' + count + ']';
                    $(this).removeClass('done').addClass('in_progress');
                    $($('#' + type + '_nav_totals_' + i)[0]).removeClass('done').addClass('in_progress');
                }

                if (type == 'playthrough') {
                    updateMiniProgressBar(i, checked, count);
                }
            });
            if (overallChecked == overallCount) {
                this.innerHTML = '[DONE]';
                $(this).removeClass('in_progress').addClass('done');
            } else {
                this.innerHTML = '[' + overallChecked + '/' + overallCount + ']';
                $(this).removeClass('done').addClass('in_progress');
            }

            if (type == 'playthrough') {
                var percent = (overallCount > 0) ? Math.round((overallChecked / overallCount) * 100) : 0;
                $('#playthrough_progress_bar')
                    .css('width', percent + '%')
                    .text(percent + '%');
            }
        });
    }

    function sanitizeChecklistData(data) {
        var cleanData = {};
        if (!data || typeof data != 'object') {
            return cleanData;
        }
        $.each(data, function(key, value) {
            if ($('#' + key).length > 0) {
                cleanData[key] = (value === true);
            }
        });
        return cleanData;
    }

    function exportCurrentProgress() {
        var exportData = {
            version: 1,
            profileName: profiles.current,
            exportedAt: (new Date()).toISOString(),
            checklistData: profiles[profilesKey][profiles.current].checklistData
        };
        var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        var url = window.URL.createObjectURL(blob);
        var link = document.createElement('a');
        var safeProfileName = profiles.current.replace(/[^a-z0-9_-]/gi, '_');
        link.href = url;
        link.download = 'dark-souls-checklist-' + safeProfileName + '.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(function() {
            window.URL.revokeObjectURL(url);
        }, 0);
    }

    function importCurrentProgress(file) {
        var reader = new FileReader();
        reader.onload = function(loadEvent) {
            try {
                var parsed = JSON.parse(loadEvent.target.result);
                var checklistData = getImportChecklistData(parsed);
                if (!checklistData) {
                    alert('Invalid import file. Please use a file exported from this page.');
                    return;
                }
                profiles[profilesKey][profiles.current].checklistData = sanitizeChecklistData(checklistData);
                $.jStorage.set(profilesKey, profiles);
                populateChecklists();
                alert('Progress imported into profile: ' + profiles.current);
            } catch (err) {
                alert('Unable to read import file. Please check that it is valid JSON.');
            }
        };
        reader.readAsText(file);
    }

    function getImportChecklistData(parsedImport) {
        if (!parsedImport || typeof parsedImport != 'object') {
            return null;
        }

        if (parsedImport.checklistData && typeof parsedImport.checklistData == 'object') {
            return parsedImport.checklistData;
        }

        return parsedImport;
    }

    function addSectionControls() {
        var sectionIndex = 1;
        $('#tabPlaythrough > h3').each(function() {
            var $h3 = $(this);
            var $totalSpan = $h3.find('[id^="playthrough_totals_"]');
            if ($totalSpan.length === 0) return;

            var totalId = $totalSpan.attr('id');
            var match = totalId.match(/playthrough_totals_(\d+)/);
            if (!match) return;

            var sectionNum = parseInt(match[1]);
            var sectionName = $h3.text().split(/[\[\(]/)[0].trim();

            var collapseBtn = $('<span class="section-collapse-btn" data-section="' + sectionNum + '">▼</span>');
            $h3.prepend(collapseBtn);

            var $nextUl = $h3.next('ul');
            if ($nextUl.length) {
                $nextUl.addClass('section-content').attr('data-section-num', sectionNum);
            }

            var miniBar = '<div class="mini-progress-container" data-section="' + sectionNum + '">' +
                '<div class="mini-progress-label">' + sectionName + '</div>' +
                '<div class="progress mini-progress-bar">' +
                '<div class="bar" id="mini_progress_' + sectionNum + '" style="width: 0%; background-color: ' + getProgressColor(sectionIndex) + ';">0%</div>' +
                '</div></div>';
            $('#playthrough_mini_bars').append(miniBar);
            sectionIndex++;
        });

        $('.section-collapse-btn').click(function() {
            var sectionNum = $(this).attr('data-section');
            var $content = $('[data-section-num="' + sectionNum + '"]');
            var isCollapsed = $content.hasClass('collapsed');

            if (isCollapsed) {
                $content.removeClass('collapsed');
                $(this).text('▼');
            } else {
                $content.addClass('collapsed');
                $(this).text('▶');
            }
        });
    }

    function getProgressColor(index) {
        var colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
            '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#ABEBC6',
            '#F5A9A9', '#A9D0E5', '#F5D76E', '#D4A5A5', '#B5EAD7',
            '#E9A6BF', '#C8D6E5', '#FFD93D', '#6BCB77', '#A8E6CF',
            '#FFD3B6', '#FFAAA5', '#FF8B94', '#A0E7E5', '#FFCBA4',
            '#A8D8EA', '#AA96DA', '#FCBAD3'
        ];
        return colors[index % colors.length];
    }

    function updateMiniProgressBar(sectionNum, checked, count) {
        var percent = (count > 0) ? Math.round((checked / count) * 100) : 0;
        var $bar = $('#mini_progress_' + sectionNum);
        if ($bar.length) {
            $bar.css('width', percent + '%').text(percent + '%');
        }
    }

    function sanitizeChecklistData(data) {
        var cleanData = {};
        if (!data || typeof data != 'object') {
            return cleanData;
        }
        $.each(data, function(key, value) {
            if ($('#' + key).length > 0) {
                cleanData[key] = (value === true);
            }
        });
        return cleanData;
    }

    function addCheckbox(el) {
        var lines = $(el).html().split('\n');
        lines[0] = '<label class="checkbox"><input type="checkbox" id="' + $(el).attr('data-id') + '">' + lines[0] + '</label>';
        $(el).html(lines.join('\n'));
        if (profiles[profilesKey][profiles.current].checklistData[$(el).attr('data-id')] == true) {
            $('#' + $(el).attr('data-id')).prop('checked', true);
        }
    }

    function canDelete() {
        var count = 0;
        $.each(profiles[profilesKey], function(index, value) {
            count++;
        });
        return (count > 1);
    }

    function getFirstProfile() {
        for (var profile in profiles[profilesKey]) {
            return profile;
        }
    }

})( jQuery );
