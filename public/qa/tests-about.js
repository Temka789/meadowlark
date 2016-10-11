suite('Tests of the page "About"', function(){
  test('page should have link to "contact" page', function(){
    assert($('a[href="/contact"]').length);
  });
});
